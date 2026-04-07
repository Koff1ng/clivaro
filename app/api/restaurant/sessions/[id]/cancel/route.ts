import { NextRequest, NextResponse } from 'next/server'
import { getTenantPrismaClient, getTenantIdFromSession } from '@/lib/tenancy'
import { ensureRestaurantMode } from '@/lib/restaurant'
import { emitRestaurantEvent } from '@/lib/events'
import { requireAnyPermission } from '@/lib/api-middleware'
import { PERMISSIONS } from '@/lib/permissions'

export const dynamic = 'force-dynamic'

function apiError(status: number, message: string) {
  return NextResponse.json({ status, error: message }, { status })
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

    const prisma = await getTenantPrismaClient(tenantId)

    const tableSession = await prisma.tableSession.findUnique({
      where: { id: sessionId },
      include: { table: true },
    })

    if (!tableSession || tableSession.status !== 'OPEN') {
      return apiError(404, 'Session not found or already closed')
    }

    await prisma.$transaction(async (tx: any) => {
      await tx.tableOrderItem.updateMany({
        where: {
          order: { sessionId },
          status: { in: ['PENDING', 'COOKING'] },
        },
        data: { status: 'CANCELLED' },
      })

      await tx.tableSession.update({
        where: { id: sessionId },
        data: { status: 'CLOSED', closedAt: new Date(), totalAmount: 0 },
      })

      await tx.restaurantTable.update({
        where: { id: tableSession.tableId },
        data: { status: 'AVAILABLE' },
      })
    })

    emitRestaurantEvent(tenantId, 'TABLE_UPDATED', {
      tableId: tableSession.tableId,
      status: 'AVAILABLE',
    })

    return NextResponse.json({ success: true, message: 'Folio cancelado' })
  } catch (error: any) {
    return apiError(400, error.message || 'Failed to cancel session')
  }
}
