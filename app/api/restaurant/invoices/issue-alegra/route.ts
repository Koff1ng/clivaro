import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getTenantPrismaClient, getTenantIdFromSession } from '@/lib/tenancy'
import { getAlegraService } from '@/lib/alegra'
import { ensureRestaurantMode } from '@/lib/restaurant'
import { requireAnyPermission } from '@/lib/api-middleware'
import { PERMISSIONS } from '@/lib/permissions'

export const dynamic = 'force-dynamic'

const issueInvoiceSchema = z.object({
  sessionId: z.string().min(1),
  customerId: z.string().optional().nullable(),
  paymentMethod: z.string().optional().nullable(),
})

function apiError(status: number, message: string, details?: unknown) {
  return NextResponse.json({ status, error: message, details }, { status })
}

async function resolveFallbackCustomerId(prisma: any, createdById?: string) {
  const existing = await prisma.customer.findFirst({
    where: {
      OR: [
        { name: 'Cliente General' },
        { taxId: '222222222222' },
      ],
    },
    select: { id: true },
  })

  if (existing?.id) return existing.id

  const created = await prisma.customer.create({
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

export async function POST(req: NextRequest) {
  try {
    const authSession = await requireAnyPermission(req as any, [
      PERMISSIONS.MANAGE_SALES,
      PERMISSIONS.MANAGE_CASH,
      PERMISSIONS.MANAGE_RESTAURANT,
    ])
    if (authSession instanceof NextResponse) return authSession

    const tenantId = getTenantIdFromSession(authSession)

    const restaurantCheck = await ensureRestaurantMode(tenantId)
    if (restaurantCheck) return restaurantCheck

    const parsed = issueInvoiceSchema.safeParse(await req.json())
    if (!parsed.success) {
      return apiError(400, 'Validation error', parsed.error.flatten())
    }

    const { sessionId, customerId, paymentMethod } = parsed.data
    const prisma = await getTenantPrismaClient(tenantId)

    const session = await prisma.tableSession.findUnique({
      where: { id: sessionId },
      include: {
        table: true,
        orders: {
          where: { status: 'SENT' },
          include: {
            items: {
              include: {
                product: true,
                variant: true,
              },
            },
          },
        },
      },
    })

    if (!session || session.status !== 'OPEN') {
      return apiError(404, 'Active session not found')
    }

    const resolvedCustomerId = customerId || (await resolveFallbackCustomerId(prisma, (authSession.user as any)?.id))

    const alegraItems = session.orders.flatMap((order) =>
      order.items.map((item) => ({
        id: 1,
        name: item.product.name,
        price: item.unitPrice,
        quantity: item.quantity,
        tax: [],
      }))
    )

    const alegraService = await getAlegraService(tenantId)

    let alegraContactId = null
    if (resolvedCustomerId) {
      const customer = await prisma.customer.findUnique({ where: { id: resolvedCustomerId } })
      if (customer) {
        const contact = await alegraService.createContact({
          name: customer.name,
          identification: (customer as any).identification || '',
          email: customer.email || '',
          phone: customer.phone || '',
        })
        alegraContactId = contact.id
      }
    }

    const alegraInvoice = await alegraService.createInvoice({
      date: new Date().toISOString().split('T')[0],
      dueDate: new Date().toISOString().split('T')[0],
      client: alegraContactId || 1,
      items: alegraItems,
      paymentMethod: paymentMethod || 'cash',
    })

    const localInvoice = await prisma.invoice.create({
      data: {
        number: `INV-${alegraInvoice.number}`,
        customerId: resolvedCustomerId,
        status: 'EMITIDA',
        total: session.totalAmount + session.tipAmount,
        tipAmount: session.tipAmount || 0,
        alegraId: String(alegraInvoice.id),
        alegraNumber: String(alegraInvoice.number),
        alegraStatus: 'ISSUED',
        alegraUrl: (alegraInvoice as any).pdfUrl || null,
        createdById: (authSession.user as any)?.id || null,
      },
    })

    return NextResponse.json({
      success: true,
      invoiceId: localInvoice.id,
      alegraId: String(alegraInvoice.id),
      number: String(alegraInvoice.number),
    })
  } catch (error: any) {
    return apiError(400, error.message || 'Failed to issue invoice in Alegra')
  }
}
