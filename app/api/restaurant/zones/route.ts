import { NextResponse } from 'next/server'
import { getTenantIdFromSession, withTenantRead, withTenantTx } from '@/lib/tenancy'
import { requirePermission, requireAnyPermission } from '@/lib/api-middleware'
import { PERMISSIONS } from '@/lib/permissions'
import { logger } from '@/lib/logger'
import { ensureRestaurantMode } from '@/lib/restaurant'

export const dynamic = 'force-dynamic'

/**
 * GET: Lista todas las zonas del restaurante.
 * Allows waiter token or session with restaurant permission.
 */
export async function GET(request: Request) {
    const waiterToken = request.headers.get('x-waiter-token')
    const tenantIdHeader = request.headers.get('x-tenant-id')

    let tenantId: string

    if (waiterToken && tenantIdHeader) {
        // Waiter access via token
        const { getWaiterFromToken } = await import('@/lib/restaurant')
        const waiter = await getWaiterFromToken(waiterToken, tenantIdHeader)
        if (!waiter) {
            return NextResponse.json({ error: 'Invalid waiter token' }, { status: 401 })
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

    // Validar que el modo restaurante esté activo
    const errorResponse = await ensureRestaurantMode(tenantId)
    if (errorResponse) return errorResponse

    try {
        const zones = await withTenantRead(tenantId, async (tx) => {
            return await tx.restaurantZone.findMany({
                where: { active: true },
                include: { tables: true },
                orderBy: { createdAt: 'asc' }
            })
        })
        return NextResponse.json(zones)
    } catch (error: any) {
        logger.error('Error in api/restaurant/zones GET', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}

/**
 * POST: Crea una nueva zona de restaurante.
 */
export async function POST(request: Request) {
    const session = await requirePermission(request as any, PERMISSIONS.MANAGE_RESTAURANT)
    if (session instanceof NextResponse) return session

    const tenantId = getTenantIdFromSession(session)
    const { name, description } = await request.json()

    if (!name) {
        return NextResponse.json({ error: 'El nombre es obligatorio' }, { status: 400 })
    }

    // Validar que el modo restaurante esté activo
    const errorResponse = await ensureRestaurantMode(tenantId)
    if (errorResponse) return errorResponse

    try {
        const zone = await withTenantTx(tenantId, async (tx) => {
            return await tx.restaurantZone.create({
                data: {
                    tenantId,
                    name,
                    description,
                }
            })
        })
        return NextResponse.json(zone)
    } catch (error: any) {
        logger.error('Error in api/restaurant/zones POST', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
