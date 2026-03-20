import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getTenantPrismaClient, getTenantIdFromSession } from '@/lib/tenancy'
import { ensureRestaurantMode } from '@/lib/restaurant'
import { requireAnyPermission } from '@/lib/api-middleware'
import { PERMISSIONS } from '@/lib/permissions'

const transferSchema = z.object({
  targetSessionId: z.string().min(1),
  itemIds: z.array(z.string().min(1)).min(1),
})

function apiError(status: number, message: string, details?: unknown) {
  return NextResponse.json({ status, error: message, details }, { status })
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
    const sourceSessionId = params.id

    const restaurantCheck = await ensureRestaurantMode(tenantId)
    if (restaurantCheck) return restaurantCheck

    const parsed = transferSchema.safeParse(await req.json())
    if (!parsed.success) {
      return apiError(400, 'Validation error', parsed.error.flatten())
    }

    const { targetSessionId, itemIds } = parsed.data

    if (sourceSessionId === targetSessionId) {
      return apiError(400, 'Las cuentas de origen y destino deben ser diferentes')
    }

    const prisma = await getTenantPrismaClient(tenantId)

    const [sourceSession, targetSession] = await Promise.all([
      prisma.tableSession.findUnique({ where: { id: sourceSessionId } }),
      prisma.tableSession.findUnique({ where: { id: targetSessionId } }),
    ])

    if (!sourceSession || sourceSession.status !== 'OPEN') {
      return apiError(404, 'Cuenta origen no encontrada o cerrada')
    }
    if (!targetSession || targetSession.status !== 'OPEN') {
      return apiError(404, 'Cuenta destino no encontrada o cerrada')
    }

    const items = await prisma.tableOrderLine.findMany({
      where: {
        id: { in: itemIds },
        order: { sessionId: sourceSessionId },
        status: { not: 'CANCELLED' },
      },
      include: { order: true },
    })

    if (items.length === 0) {
      return apiError(404, 'No se encontraron items transferibles')
    }

    const transferAmount = items.reduce(
      (sum: number, i: any) => sum + i.unitPrice * i.quantity,
      0
    )

    await prisma.$transaction(async (tx: any) => {
      await tx.tableOrder.create({
        data: {
          tenantId,
          sessionId: targetSessionId,
          waiterId: targetSession.waiterId,
          status: 'SENT',
          items: {
            create: items.map((i: any) => ({
              productId: i.productId,
              variantId: i.variantId,
              quantity: i.quantity,
              unitPrice: i.unitPrice,
              notes: i.notes,
              status: i.status === 'PENDING' ? 'PENDING' : i.status,
            })),
          },
        },
      })

      await tx.tableOrderLine.updateMany({
        where: { id: { in: itemIds } },
        data: { status: 'CANCELLED' },
      })

      await tx.tableSession.update({
        where: { id: sourceSessionId },
        data: { totalAmount: { decrement: transferAmount } },
      })

      await tx.tableSession.update({
        where: { id: targetSessionId },
        data: { totalAmount: { increment: transferAmount } },
      })
    })

    return NextResponse.json({
      success: true,
      transferred: items.length,
      amount: transferAmount,
    })
  } catch (error: any) {
    return apiError(400, error.message || 'Error al transferir items')
  }
}
