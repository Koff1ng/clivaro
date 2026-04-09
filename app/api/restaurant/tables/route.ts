import { NextResponse } from 'next/server'
import { getTenantIdFromSession, withTenantRead, withTenantTx } from '@/lib/tenancy'
import { requirePermission, requireAnyPermission } from '@/lib/api-middleware'
import { PERMISSIONS } from '@/lib/permissions'
import { logger } from '@/lib/logger'
import { ensureRestaurantMode, getWaiterFromToken } from '@/lib/restaurant'

export const dynamic = 'force-dynamic'

/**
 * GET: Lista todas las mesas (opcionalmente filtradas por zona).
 * Permite acceso por sesion con permiso de restaurante o por token de mesero.
 */
export async function GET(request: Request) {
  const waiterToken = request.headers.get('x-waiter-token')
  const tenantIdHeader = request.headers.get('x-tenant-id')

  let tenantId: string
  if (waiterToken && tenantIdHeader) {
    const waiter = await getWaiterFromToken(waiterToken, tenantIdHeader)
    if (!waiter) {
      return NextResponse.json({ status: 401, error: 'Invalid waiter token' }, { status: 401 })
    }
    tenantId = tenantIdHeader
  } else {
    const session = await requireAnyPermission(request as any, [
      PERMISSIONS.MANAGE_RESTAURANT,
      PERMISSIONS.MANAGE_SALES,
      PERMISSIONS.MANAGE_CASH,
    ])
    if (session instanceof NextResponse) return session
    tenantId = getTenantIdFromSession(session)
  }

  const { searchParams } = new URL(request.url)
  const zoneId = searchParams.get('zoneId')

  const errorResponse = await ensureRestaurantMode(tenantId)
  if (errorResponse) return errorResponse

  try {
    const tables = await withTenantRead(tenantId, async (tx) => {
      return await tx.restaurantTable.findMany({
        where: {
          active: true,
          ...(zoneId && { zoneId }),
        },
        orderBy: { name: 'asc' },
      })
    })
    return NextResponse.json(tables)
  } catch (error: any) {
    logger.error('Error in api/restaurant/tables GET', error)
    return NextResponse.json({ status: 500, error: error.message }, { status: 500 })
  }
}

/**
 * POST: Crea una nueva mesa.
 */
export async function POST(request: Request) {
  const session = await requirePermission(request as any, PERMISSIONS.MANAGE_RESTAURANT)
  if (session instanceof NextResponse) return session

  const tenantId = getTenantIdFromSession(session)
  const { zoneId, name, capacity, x, y } = await request.json()

  if (!zoneId || !name) {
    return NextResponse.json({ status: 400, error: 'Zona y nombre son obligatorios' }, { status: 400 })
  }

  const errorResponse = await ensureRestaurantMode(tenantId)
  if (errorResponse) return errorResponse

  try {
    const table = await withTenantTx(tenantId, async (tx) => {
      return await (tx as any).restaurantTable.create({
        data: {
          zoneId,
          name,
          capacity: capacity || 2,
          x: x || 0,
          y: y || 0,
        },
      })
    })
    return NextResponse.json(table)
  } catch (error: any) {
    logger.error('Error in api/restaurant/tables POST', error)
    return NextResponse.json({ status: 500, error: error.message }, { status: 500 })
  }
}
