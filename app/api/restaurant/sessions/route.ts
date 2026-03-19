import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getTenantPrismaClient, getTenantIdFromSession } from '@/lib/tenancy'
import { ensureRestaurantMode, getWaiterFromToken } from '@/lib/restaurant'
import { emitRestaurantEvent } from '@/lib/events'
import { requireAnyPermission } from '@/lib/api-middleware'
import { PERMISSIONS } from '@/lib/permissions'

const createSessionSchema = z.object({
  tableId: z.string().min(1),
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

export async function GET(req: NextRequest) {
  try {
    const context = await resolveRestaurantContext(req)
    if ('error' in context) return context.error

    const tableId = req.nextUrl.searchParams.get('tableId')
    if (!tableId) return apiError(400, 'Table ID missing')

    const restaurantCheck = await ensureRestaurantMode(context.tenantId)
    if (restaurantCheck) return restaurantCheck

    const prisma = await getTenantPrismaClient(context.tenantId)
    const session = await prisma.tableSession.findFirst({
      where: {
        tableId,
        status: 'OPEN',
      },
      include: {
        waiter: { select: { id: true, name: true, code: true } },
        orders: {
          include: {
            items: true,
          },
        },
      },
    })

    return NextResponse.json(session)
  } catch (error: any) {
    return apiError(400, error.message || 'Failed to fetch table session')
  }
}

export async function POST(req: NextRequest) {
  try {
    const context = await resolveRestaurantContext(req)
    if ('error' in context) return context.error

    const restaurantCheck = await ensureRestaurantMode(context.tenantId)
    if (restaurantCheck) return restaurantCheck

    const parsed = createSessionSchema.safeParse(await req.json())
    if (!parsed.success) {
      return apiError(400, 'Validation error', parsed.error.flatten())
    }

    const prisma = await getTenantPrismaClient(context.tenantId)

    const existing = await prisma.tableSession.findFirst({
      where: { tableId: parsed.data.tableId, status: 'OPEN' },
    })

    if (existing) {
      return apiError(409, 'Table already has an open session')
    }

    const waiterId = context.waiter?.id
    if (!waiterId) {
      return apiError(403, 'Waiter context is required to open a table session')
    }

    const session = await prisma.$transaction(async (tx) => {
      const newSession = await tx.tableSession.create({
        data: {
          tenantId: context.tenantId,
          tableId: parsed.data.tableId,
          waiterId,
          status: 'OPEN',
        },
      })

      await tx.restaurantTable.update({
        where: { id: parsed.data.tableId },
        data: { status: 'OCCUPIED' },
      })

      return newSession
    })

    emitRestaurantEvent(context.tenantId, 'TABLE_UPDATED', {
      tableId: parsed.data.tableId,
      status: 'OCCUPIED',
    })

    return NextResponse.json(session)
  } catch (error: any) {
    return apiError(400, error.message || 'Failed to open table session')
  }
}
