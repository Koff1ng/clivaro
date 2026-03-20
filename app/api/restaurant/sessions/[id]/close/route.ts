import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getTenantPrismaClient, getTenantIdFromSession } from '@/lib/tenancy'
import { ensureRestaurantMode } from '@/lib/restaurant'
import { emitRestaurantEvent } from '@/lib/events'
import { requireAnyPermission } from '@/lib/api-middleware'
import { PERMISSIONS } from '@/lib/permissions'

const paymentEntrySchema = z.object({
  method: z.enum(['CASH', 'CARD', 'TRANSFER', 'OTHER']),
  amount: z.number().positive(),
  reference: z.string().optional().nullable(),
})

const closeSessionSchema = z.object({
  customerId: z.string().optional().nullable(),
  discountAmount: z.number().min(0).optional(),
  payments: z.array(paymentEntrySchema).optional(),
})

function apiError(status: number, message: string, details?: unknown) {
  return NextResponse.json({ status, error: message, details }, { status })
}

async function resolveFallbackCustomerId(tx: any, createdById?: string) {
  const existing = await tx.customer.findFirst({
    where: {
      OR: [
        { name: 'Cliente General' },
        { taxId: '222222222222' },
      ],
    },
    select: { id: true },
  })

  if (existing?.id) return existing.id

  const created = await tx.customer.create({
    data: {
      name: 'Cliente General',
      taxId: '222222222222',
      idType: 'CC',
      isCompany: false,
      taxRegime: 'SIMPLIFIED',
      createdById: createdById || null,
    },
    select: { id: true },
  })

  return created.id
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await requireAnyPermission(req as any, [
      PERMISSIONS.MANAGE_SALES,
      PERMISSIONS.MANAGE_CASH,
      PERMISSIONS.MANAGE_RESTAURANT,
    ])
    if (session instanceof NextResponse) return session

    const tenantId = getTenantIdFromSession(session)
    const sessionId = params.id

    const restaurantCheck = await ensureRestaurantMode(tenantId)
    if (restaurantCheck) return restaurantCheck

    const parsed = closeSessionSchema.safeParse(await req.json().catch(() => ({})))
    if (!parsed.success) {
      return apiError(400, 'Validation error', parsed.error.flatten())
    }

    const prisma = await getTenantPrismaClient(tenantId)

    const tableSession = await prisma.tableSession.findUnique({
      where: { id: sessionId },
      include: {
        table: true,
        orders: {
          include: { items: { include: { product: true } } },
        },
      },
    })

    if (!tableSession || tableSession.status !== 'OPEN') {
      return apiError(404, 'Session not found or already closed')
    }

    const hasPending = tableSession.orders.some(
      (o: any) => o.status === 'PENDING' || o.items.some((i: any) => i.status !== 'SERVED' && i.status !== 'CANCELLED')
    )

    const allItems = tableSession.orders.flatMap((o: any) => o.items)
    const activeItems = allItems.filter((i: any) => i.status !== 'CANCELLED')
    const computedSubtotal = activeItems.reduce(
      (sum: number, i: any) => sum + i.unitPrice * i.quantity, 0
    )
    const computedTax = activeItems.reduce((sum: number, i: any) => {
      const rate = i.product?.taxRate ?? 0
      if (rate <= 0) return sum
      const base = (i.unitPrice * i.quantity) / (1 + rate / 100)
      return sum + (i.unitPrice * i.quantity - base)
    }, 0)

    const discountAmount = parsed.data.discountAmount || 0
    const tipAmt = (tableSession as any).tipAmount ?? 0
    const invoiceSubtotal = Math.round(computedSubtotal * 100) / 100
    const invoiceTotal = Math.max(0, Math.round((computedSubtotal - discountAmount + tipAmt) * 100) / 100)

    const paymentsData = parsed.data.payments && parsed.data.payments.length > 0
      ? parsed.data.payments
      : null

    const result = await prisma.$transaction(async (tx) => {
      const customerId = parsed.data.customerId || (await resolveFallbackCustomerId(tx, (session.user as any)?.id))

      // Build invoice data — tipAmount may not exist in older tenant schemas
      const invoiceCreateData: any = {
        number: `RES-${Date.now()}`,
        customerId,
        status: 'EMITIDA',
        subtotal: invoiceSubtotal,
        tax: Math.round(computedTax * 100) / 100,
        total: invoiceTotal,
        issuedAt: new Date(),
        createdById: (session.user as any)?.id || null,
      }

      // Safely include tipAmount — field may not exist in older tenant DBs
      if (tipAmt > 0) {
        invoiceCreateData.tipAmount = tipAmt
      }

      const invoice = await tx.invoice.create({ data: invoiceCreateData }).catch(async (err: any) => {
        // If tipAmount column doesn't exist yet, retry without it
        if (err?.code === 'P2022' && err?.message?.includes('tipAmount')) {
          delete invoiceCreateData.tipAmount
          return tx.invoice.create({ data: invoiceCreateData })
        }
        throw err
      })

      // Register payment records if provided
      if (paymentsData) {
        for (const p of paymentsData) {
          await tx.payment.create({
            data: {
              invoiceId: invoice.id,
              amount: p.amount,
              method: p.method,
              reference: p.reference || null,
            },
          })
        }
      }

      const closedSession = await tx.tableSession.update({
        where: { id: sessionId },
        data: {
          status: 'CLOSED',
          closedAt: new Date(),
        },
      })

      await tx.restaurantTable.update({
        where: { id: tableSession.tableId },
        data: { status: 'AVAILABLE' },
      })

      return { closedSession, invoice }
    })

    emitRestaurantEvent(tenantId, 'TABLE_UPDATED', {
      tableId: tableSession.tableId,
      status: 'AVAILABLE',
    })

    emitRestaurantEvent(tenantId, 'SESSION_CLOSED', {
      sessionId: tableSession.id,
      totalAmount: tableSession.totalAmount,
    })

    return NextResponse.json({
      ...result,
      warnings: hasPending ? ['Session was closed with pending items'] : [],
    })
  } catch (error: any) {
    return apiError(400, error.message || 'Failed to close table session')
  }
}
