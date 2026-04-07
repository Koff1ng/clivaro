import { NextRequest, NextResponse } from 'next/server'
import { getTenantPrismaClient, getTenantIdFromSession } from '@/lib/tenancy'
import { ensureRestaurantMode, getWaiterFromToken } from '@/lib/restaurant'
import { emitRestaurantEvent } from '@/lib/events'
import { requireAnyPermission } from '@/lib/api-middleware'
import { PERMISSIONS } from '@/lib/permissions'

export const dynamic = 'force-dynamic'

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

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const context = await resolveRestaurantContext(req)
    if ('error' in context) return context.error

    const orderId = params.id
    if (!orderId) return apiError(400, 'Order ID missing')

    const restaurantCheck = await ensureRestaurantMode(context.tenantId)
    if (restaurantCheck) return restaurantCheck

    const prisma = await getTenantPrismaClient(context.tenantId)

    const order = await prisma.tableOrder.findUnique({
      where: { id: orderId },
      include: {
        session: {
          include: { table: true },
        },
        items: {
          include: {
            product: { select: { name: true } },
          },
        },
      },
    })

    if (!order || order.tenantId !== context.tenantId) {
      return apiError(404, 'Order not found')
    }

    if (order.status !== 'PENDING') {
      return apiError(400, `Order is already ${order.status}`)
    }

    const updatedOrder = await prisma.tableOrder.update({
      where: { id: orderId },
      data: { status: 'SENT' },
      include: {
        items: {
          include: {
            product: { select: { name: true } },
          },
        },
      },
    })

    emitRestaurantEvent(context.tenantId, 'ORDER_SENT_TO_KITCHEN', {
      orderId: updatedOrder.id,
      tableName: order.session.table.name,
      items: updatedOrder.items.map((item) => ({
        id: item.id,
        name: item.product.name,
        quantity: item.quantity,
        notes: item.notes,
      })),
      timestamp: new Date(),
    })

    return NextResponse.json(updatedOrder)
  } catch (error: any) {
    return apiError(400, error.message || 'Failed to send order to kitchen')
  }
}
