import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getTenantPrismaClient, getTenantIdFromSession } from '@/lib/tenancy'
import { ensureRestaurantMode } from '@/lib/restaurant'
import { requireAnyPermission } from '@/lib/api-middleware'
import { PERMISSIONS } from '@/lib/permissions'

export const dynamic = 'force-dynamic'
import { safeErrorMessage } from '@/lib/safe-error'

const updateItemSchema = z.object({
  unitPrice: z.number().min(0).optional(),
  notes: z.string().optional().nullable(),
})

function apiError(status: number, message: string) {
  return NextResponse.json({ status, error: message }, { status })
}

export async function PATCH(
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
    const itemId = params.id

    const restaurantCheck = await ensureRestaurantMode(tenantId)
    if (restaurantCheck) return restaurantCheck

    const parsed = updateItemSchema.safeParse(await req.json())
    if (!parsed.success) {
      return apiError(400, 'Validation error')
    }

    const prisma = await getTenantPrismaClient(tenantId)

    const item = await prisma.tableOrderLine.findUnique({
      where: { id: itemId },
      include: { order: { include: { session: true } } },
    })

    if (!item || item.status === 'CANCELLED') {
      return apiError(404, 'Item no encontrado o cancelado')
    }

    if (item.order.session.status !== 'OPEN') {
      return apiError(400, 'La cuenta no esta abierta')
    }

    const updateData: Record<string, any> = {}
    let priceDiff = 0

    if (parsed.data.unitPrice !== undefined) {
      priceDiff = (parsed.data.unitPrice - item.unitPrice) * item.quantity
      updateData.unitPrice = parsed.data.unitPrice
    }

    if (parsed.data.notes !== undefined) {
      updateData.notes = parsed.data.notes
    }

    if (Object.keys(updateData).length === 0) {
      return apiError(400, 'No hay campos para actualizar')
    }

    await prisma.$transaction(async (tx: any) => {
      await tx.tableOrderLine.update({
        where: { id: itemId },
        data: updateData,
      })

      if (priceDiff !== 0) {
        await tx.tableSession.update({
          where: { id: item.order.sessionId },
          data: { totalAmount: { increment: priceDiff } },
        })
      }
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return apiError(400, safeErrorMessage(error, 'Error al actualizar item'))
  }
}
