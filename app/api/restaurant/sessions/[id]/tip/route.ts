import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getTenantPrismaClient, getTenantIdFromSession } from '@/lib/tenancy'
import { ensureRestaurantMode, getWaiterFromToken } from '@/lib/restaurant'
import { requireAnyPermission } from '@/lib/api-middleware'
import { PERMISSIONS } from '@/lib/permissions'

const tipSchema = z.object({
  tipAmount: z.number().min(0),
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

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const context = await resolveRestaurantContext(req)
    if ('error' in context) return context.error

    const sessionId = params.id
    const parsed = tipSchema.safeParse(await req.json())
    if (!parsed.success) {
      return apiError(400, 'Validation error', parsed.error.flatten())
    }

    const restaurantCheck = await ensureRestaurantMode(context.tenantId)
    if (restaurantCheck) return restaurantCheck

    const prisma = await getTenantPrismaClient(context.tenantId)

    const existing = await prisma.tableSession.findUnique({ where: { id: sessionId } })
    if (!existing || existing.tenantId !== context.tenantId) {
      return apiError(404, 'Session not found')
    }

    if (existing.status !== 'OPEN') {
      return apiError(400, 'Cannot update tip for a closed session')
    }

    if (context.waiter && existing.waiterId !== context.waiter.id) {
      return apiError(403, 'Waiter cannot edit tip for another waiter session')
    }

    await prisma.tableSession.update({
      where: { id: sessionId },
      data: {
        tipAmount: parsed.data.tipAmount,
      },
    })

    return NextResponse.json({ success: true, tipAmount: parsed.data.tipAmount })
  } catch (error: any) {
    return apiError(400, error.message || 'Failed to update tip')
  }
}
