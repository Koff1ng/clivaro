import { NextResponse } from 'next/server'
import { getTenantIdFromSession } from '@/lib/tenancy'
import { requirePermission } from '@/lib/api-middleware'
import { PERMISSIONS } from '@/lib/permissions'
import { logger } from '@/lib/logger'
import { getRestaurantConfig, updateRestaurantConfig, ensureRestaurantMode } from '@/lib/restaurant'

export const dynamic = 'force-dynamic';

/**
 * GET: Obtiene la configuración del restaurante para el tenant actual.
 */
export async function GET(request: Request) {
    const session = await requirePermission(request as any, PERMISSIONS.MANAGE_RESTAURANT)
    if (session instanceof NextResponse) return session

    const tenantId = getTenantIdFromSession(session)

    try {
        // En este caso, permitimos el GET de la configuración aunque enableRestaurantMode sea false 
        // para que la UI pueda activarla.
        const config = await getRestaurantConfig(tenantId)
        return NextResponse.json(config)
    } catch (error: any) {
        logger.error('Error in api/restaurant/config GET', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}

/**
 * POST: Crea o actualiza la configuración del restaurante.
 */
export async function POST(request: Request) {
    const session = await requirePermission(request as any, PERMISSIONS.MANAGE_RESTAURANT)
    if (session instanceof NextResponse) return session

    const tenantId = getTenantIdFromSession(session)
    const data = await request.json()

    try {
        const config = await updateRestaurantConfig(tenantId, data)
        return NextResponse.json({ success: true, config })
    } catch (error: any) {
        logger.error('Error in api/restaurant/config POST', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
