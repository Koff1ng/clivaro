import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getTenantPrismaClient, getTenantIdFromSession } from '@/lib/tenancy'
import { ensureRestaurantMode, getWaiterFromToken } from '@/lib/restaurant'
import { emitRestaurantEvent } from '@/lib/events'
import { requireAnyPermission } from '@/lib/api-middleware'
import { PERMISSIONS } from '@/lib/permissions'

export const dynamic = 'force-dynamic'

const createSessionSchema = z.object({
  tableId: z.string().optional(),
  tableName: z.string().optional(),
  waiterId: z.string().optional(),
}).refine(
  (d) => d.tableId || d.tableName,
  { message: 'tableId or tableName is required' }
)

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

const DEFAULT_ZONE_NAME = 'General'

async function resolveOrCreateTable(
  prisma: any,
  tenantId: string,
  tableId?: string,
  tableName?: string
) {
  if (tableId) {
    const table = await prisma.restaurantTable.findUnique({ where: { id: tableId } })
    if (!table) throw new Error('Mesa no encontrada')
    return table
  }

  if (!tableName) throw new Error('tableName o tableId requerido')

  const normalized = tableName.trim()
  if (!normalized) throw new Error('El nombre de la mesa no puede estar vacio')

  const existing = await prisma.restaurantTable.findFirst({
    where: { tenantId, name: normalized, active: true },
  })
  if (existing) return existing

  let zone = await prisma.restaurantZone.findFirst({
    where: { tenantId, name: DEFAULT_ZONE_NAME, active: true },
  })
  if (!zone) {
    zone = await prisma.restaurantZone.create({
      data: { tenantId, name: DEFAULT_ZONE_NAME },
    })
  }

  return await prisma.restaurantTable.create({
    data: {
      tenantId,
      zoneId: zone.id,
      name: normalized,
      capacity: 4,
      status: 'AVAILABLE',
    },
  })
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

    const activeShift = await prisma.cashShift.findFirst({
      where: { status: 'OPEN' },
    })
    if (!activeShift) {
      return apiError(403, 'No hay un turno de caja abierto. Abra un turno antes de abrir mesas.')
    }

    const table = await resolveOrCreateTable(
      prisma,
      context.tenantId,
      parsed.data.tableId,
      parsed.data.tableName
    )

    const existing = await prisma.tableSession.findFirst({
      where: { tableId: table.id, status: 'OPEN' },
      include: { table: { select: { id: true, name: true } } },
    })

    if (existing) {
      return NextResponse.json({ ...existing, reused: true })
    }

    const waiterId = context.waiter?.id ?? parsed.data.waiterId
    if (!waiterId) {
      return apiError(403, 'waiterId requerido: use waiter token o pase waiterId en el body')
    }

    const session = await prisma.$transaction(async (tx: any) => {
      const newSession = await tx.tableSession.create({
        data: {
          tenantId: context.tenantId,
          tableId: table.id,
          waiterId,
          status: 'OPEN',
        },
        include: { table: { select: { id: true, name: true } } },
      })

      await tx.restaurantTable.update({
        where: { id: table.id },
        data: { status: 'OCCUPIED' },
      })

      return newSession
    })

    emitRestaurantEvent(context.tenantId, 'TABLE_UPDATED', {
      tableId: table.id,
      status: 'OCCUPIED',
    })

    return NextResponse.json(session)
  } catch (error: any) {
    return apiError(400, error.message || 'Failed to open table session')
  }
}
