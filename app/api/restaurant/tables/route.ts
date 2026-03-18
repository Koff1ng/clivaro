import { NextResponse } from 'next/server'
import { getTenantIdFromSession, withTenantRead, withTenantTx } from '@/lib/tenancy'
import { requirePermission } from '@/lib/api-middleware'
import { PERMISSIONS } from '@/lib/permissions'
import { logger } from '@/lib/logger'
import { ensureRestaurantMode } from '@/lib/restaurant'

/**
 * GET: Lista todas las mesas (opcionalmente filtradas por zona).
 */
export async function GET(request: Request) {
    const session = await requirePermission(request as any, PERMISSIONS.MANAGE_RESTAURANT)
    if (session instanceof NextResponse) return session

    const tenantId = getTenantIdFromSession(session)
    const { searchParams } = new URL(request.url)
    const zoneId = searchParams.get('zoneId')

    // Validar que el modo restaurante esté activo
    const errorResponse = await ensureRestaurantMode(tenantId)
    if (errorResponse) return errorResponse

    try {
        const tables = await withTenantRead(tenantId, async (tx) => {
            return await tx.restaurantTable.findMany({
                where: { 
                    active: true,
                    ...(zoneId && { zoneId })
                },
                orderBy: { name: 'asc' }
            })
        })
        return NextResponse.json(tables)
    } catch (error: any) {
        logger.error('Error in api/restaurant/tables GET', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
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
        return NextResponse.json({ error: 'Zona y nombre son obligatorios' }, { status: 400 })
    }

    // Validar que el modo restaurante esté activo
    const errorResponse = await ensureRestaurantMode(tenantId)
    if (errorResponse) return errorResponse

    try {
        const table = await withTenantTx(tenantId, async (tx) => {
            return await tx.restaurantTable.create({
                data: {
                    zoneId,
                    name,
                    capacity: capacity || 2,
                    x: x || 0,
                    y: y || 0,
                }
            })
        })
        return NextResponse.json(table)
    } catch (error: any) {
        logger.error('Error in api/restaurant/tables POST', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
