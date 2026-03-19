import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getTenantPrismaClient, getTenantIdFromSession } from '@/lib/tenancy'
import { ensureRestaurantMode } from '@/lib/restaurant'
import { requireAnyPermission } from '@/lib/api-middleware'
import { PERMISSIONS } from '@/lib/permissions'

const updateSchema = z.object({
  waiterId: z.string().min(1).optional(),
})

function apiError(status: number, message: string, details?: unknown) {
  return NextResponse.json({ status, error: message, details }, { status })
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
    const sessionId = params.id

    const restaurantCheck = await ensureRestaurantMode(tenantId)
    if (restaurantCheck) return restaurantCheck

    const parsed = updateSchema.safeParse(await req.json())
    if (!parsed.success) {
      return apiError(400, 'Validation error', parsed.error.flatten())
    }

    const prisma = await getTenantPrismaClient(tenantId)
    const tableSession = await prisma.tableSession.findUnique({
      where: { id: sessionId },
    })

    if (!tableSession || tableSession.status !== 'OPEN') {
      return apiError(404, 'Session not found or not open')
    }

    const updateData: Record<string, string> = {}

    if (parsed.data.waiterId) {
      const waiter = await prisma.waiterProfile.findUnique({
        where: { id: parsed.data.waiterId },
      })
      if (!waiter) return apiError(404, 'Waiter not found')
      updateData.waiterId = parsed.data.waiterId
    }

    if (Object.keys(updateData).length === 0) {
      return apiError(400, 'No fields to update')
    }

    const updated = await prisma.tableSession.update({
      where: { id: sessionId },
      data: updateData,
      include: {
        waiter: { select: { id: true, name: true, code: true } },
        table: { select: { id: true, name: true } },
      },
    })

    return NextResponse.json(updated)
  } catch (error: any) {
    return apiError(400, error.message || 'Failed to update session')
  }
}
