import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getTenantPrismaClient, getTenantIdFromSession } from '@/lib/tenancy'
import { ensureRestaurantMode, getWaiterFromToken } from '@/lib/restaurant'
import { emitRestaurantEvent } from '@/lib/events'
import { requireAnyPermission } from '@/lib/api-middleware'
import { PERMISSIONS } from '@/lib/permissions'

const createOrderSchema = z.object({
  sessionId: z.string().min(1),
  items: z.array(
    z.object({
      productId: z.string().min(1),
      variantId: z.string().optional().nullable(),
      quantity: z.number().positive(),
      unitPrice: z.number().min(0),
      notes: z.string().optional().nullable(),
    })
  ).min(1),
})

function apiError(status: number, message: string, details?: unknown) {
  return NextResponse.json({ status, error: message, details }, { status })
}

async function resolveRestaurantContext(req: Request) {
  const tenantIdHeader = req.headers.get('x-tenant-id')
  const waiterToken = req.headers.get('x-waiter-token')

  if (tenantIdHeader && waiterToken) {
    const waiter = await getWaiterFromToken(waiterToken, tenantIdHeader)
    if (!waiter) {
      return { error: apiError(401, 'Invalid waiter token') }
    }
    return { tenantId: tenantIdHeader, waiter }
  }

  const session = await requireAnyPermission(req as any, [
    PERMISSIONS.MANAGE_SALES,
    PERMISSIONS.MANAGE_RESTAURANT,
    PERMISSIONS.MANAGE_CASH,
  ])
  if (session instanceof NextResponse) {
    return { error: session }
  }

  return { tenantId: getTenantIdFromSession(session), waiter: null }
}

export async function POST(req: NextRequest) {
  try {
    const context = await resolveRestaurantContext(req)
    if ('error' in context) return context.error

    const restaurantCheck = await ensureRestaurantMode(context.tenantId)
    if (restaurantCheck) return restaurantCheck

    const parsed = createOrderSchema.safeParse(await req.json())
    if (!parsed.success) {
      return apiError(400, 'Validation error', parsed.error.flatten())
    }

    if (!context.waiter?.id) {
      return apiError(403, 'Waiter context is required to create orders')
    }

    const prisma = await getTenantPrismaClient(context.tenantId)

    const session = await prisma.tableSession.findUnique({
      where: { id: parsed.data.sessionId },
      include: { table: true },
    })

    if (!session || session.status !== 'OPEN') {
      return apiError(400, 'Session is not open')
    }

    const orderTotal = parsed.data.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0)

    const order = await prisma.$transaction(async (tx) => {
      const newOrder = await tx.tableOrder.create({
        data: {
          tenantId: context.tenantId,
          sessionId: parsed.data.sessionId,
          waiterId: context.waiter!.id,
          status: 'PENDING',
          items: {
            create: parsed.data.items.map((item) => ({
              productId: item.productId,
              variantId: item.variantId || null,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              notes: item.notes || null,
              status: 'PENDING',
            })),
          },
        },
        include: {
          items: true,
        },
      })

      await tx.tableSession.update({
        where: { id: parsed.data.sessionId },
        data: {
          totalAmount: {
            increment: orderTotal,
          },
        },
      })

      return newOrder
    })

    emitRestaurantEvent(context.tenantId, 'NEW_ORDER', {
      orderId: order.id,
      tableId: session.tableId,
      tableName: session.table.name,
      waiterName: context.waiter.name,
      items: order.items,
    })

    return NextResponse.json(order)
  } catch (error: any) {
    return apiError(400, error.message || 'Failed to create order')
  }
}
