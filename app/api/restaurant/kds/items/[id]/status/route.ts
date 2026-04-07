import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getTenantPrismaClient, getTenantIdFromSession } from '@/lib/tenancy'
import { ensureRestaurantMode } from '@/lib/restaurant'
import { emitRestaurantEvent } from '@/lib/events'
import { requireAnyPermission } from '@/lib/api-middleware'
import { PERMISSIONS } from '@/lib/permissions'

export const dynamic = 'force-dynamic'

const statusSchema = z.object({
  status: z.enum(['PENDING', 'COOKING', 'READY', 'SERVED', 'CANCELLED']),
})

const allowedTransitions: Record<string, string[]> = {
  PENDING: ['COOKING', 'READY', 'SERVED', 'CANCELLED'],
  COOKING: ['READY', 'SERVED', 'CANCELLED'],
  READY: ['SERVED'],
  SERVED: [],
  CANCELLED: [],
}

function apiError(status: number, message: string, details?: unknown) {
  return NextResponse.json({ status, error: message, details }, { status })
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await requireAnyPermission(req as any, [
      PERMISSIONS.MANAGE_RESTAURANT,
      PERMISSIONS.MANAGE_SALES,
    ])
    if (session instanceof NextResponse) return session

    const tenantId = getTenantIdFromSession(session)
    const itemId = params.id
    if (!itemId) return apiError(400, 'Item ID missing')

    const parsed = statusSchema.safeParse(await req.json())
    if (!parsed.success) {
      return apiError(400, 'Validation error', parsed.error.flatten())
    }

    const restaurantCheck = await ensureRestaurantMode(tenantId)
    if (restaurantCheck) return restaurantCheck

    const prisma = await getTenantPrismaClient(tenantId)

    const existing = await prisma.tableOrderLine.findUnique({
      where: { id: itemId },
      include: {
        order: {
          include: {
            session: { include: { table: true } },
          },
        },
      },
    })

    if (!existing || existing.order.tenantId !== tenantId) {
      return apiError(404, 'Order item not found')
    }

    if (!allowedTransitions[existing.status]?.includes(parsed.data.status) && existing.status !== parsed.data.status) {
      return apiError(409, `Invalid status transition from ${existing.status} to ${parsed.data.status}`)
    }

    const updatedItem = await prisma.tableOrderLine.update({
      where: { id: itemId },
      data: { status: parsed.data.status },
      include: {
        order: {
          include: {
            session: { include: { table: true } },
          },
        },
        product: { select: { name: true } },
      },
    })

    emitRestaurantEvent(tenantId, 'ITEM_STATUS_UPDATED', {
      itemId: updatedItem.id,
      orderId: updatedItem.orderId,
      status: updatedItem.status,
      productName: updatedItem.product.name,
      tableName: updatedItem.order.session.table.name,
      timestamp: new Date(),
    })

    return NextResponse.json(updatedItem)
  } catch (error: any) {
    return apiError(400, error.message || 'Failed to update item status')
  }
}
