import { NextResponse } from 'next/server'
import { getTenantIdFromSession, withTenantRead, withTenantTx } from '@/lib/tenancy'
import { requirePermission } from '@/lib/api-middleware'
import { PERMISSIONS } from '@/lib/permissions'
import { logger } from '@/lib/logger'
import { ensureRestaurantMode } from '@/lib/restaurant'

/**
 * GET: Lista todas las zonas del restaurante.
 */
export async function GET(request: Request) {
    const session = await requirePermission(request as any, PERMISSIONS.MANAGE_RESTAURANT)
    if (session instanceof NextResponse) return session

    const tenantId = getTenantIdFromSession(session)

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
