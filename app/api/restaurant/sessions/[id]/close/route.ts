import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getTenantPrismaClient, getTenantIdFromSession } from '@/lib/tenancy'
import { ensureRestaurantMode } from '@/lib/restaurant'
import { emitRestaurantEvent } from '@/lib/events'
import { requireAnyPermission } from '@/lib/api-middleware'
import { PERMISSIONS } from '@/lib/permissions'

const closeSessionSchema = z.object({
  customerId: z.string().optional().nullable(),
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

    const result = await prisma.$transaction(async (tx) => {
      const customerId = parsed.data.customerId || (await resolveFallbackCustomerId(tx, (session.user as any)?.id))

      const invoice = await tx.invoice.create({
        data: {
          number: `RES-${Date.now()}`,
          customerId,
          status: 'EMITIDA',
          subtotal: Math.round(computedSubtotal * 100) / 100,
          tax: Math.round(computedTax * 100) / 100,
          total: Math.round((computedSubtotal + tableSession.tipAmount) * 100) / 100,
          tipAmount: tableSession.tipAmount,
          issuedAt: new Date(),
          createdById: (session.user as any)?.id || null,
        },
      })

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
      tipAmount: tableSession.tipAmount,
    })

    return NextResponse.json({
      ...result,
      warnings: hasPending ? ['Session was closed with pending items'] : [],
    })
  } catch (error: any) {
    return apiError(400, error.message || 'Failed to close table session')
  }
}
