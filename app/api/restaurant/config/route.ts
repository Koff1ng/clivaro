import { NextResponse } from 'next/server'
import { getTenantIdFromSession } from '@/lib/tenancy'
import { requirePermission } from '@/lib/api-middleware'
import { PERMISSIONS } from '@/lib/permissions'
import { logger } from '@/lib/logger'
import { getRestaurantConfig, updateRestaurantConfig } from '@/lib/restaurant'
import { prisma as masterPrisma } from '@/lib/db'

export const dynamic = 'force-dynamic';

/**
 * GET: Obtiene la configuracion del restaurante para el tenant actual.
 * Merges enableRestaurantMode from TenantSettings into the response.
 */
export async function GET(request: Request) {
    const session = await requirePermission(request as any, PERMISSIONS.MANAGE_RESTAURANT)
    if (session instanceof NextResponse) return session

    const tenantId = getTenantIdFromSession(session)

    try {
        const [config, tenantSettings] = await Promise.all([
            getRestaurantConfig(tenantId),
            masterPrisma.tenantSettings.findUnique({
                where: { tenantId },
                select: { enableRestaurantMode: true },
            }),
        ])
        return NextResponse.json({
            ...config,
            enableRestaurantMode: tenantSettings?.enableRestaurantMode ?? false,
        })
    } catch (error: any) {
        logger.error('Error in api/restaurant/config GET', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}

/**
 * POST: Crea o actualiza la configuracion del restaurante.
 * enableRestaurantMode goes to TenantSettings, the rest to RestaurantConfig.
 */
export async function POST(request: Request) {
    const session = await requirePermission(request as any, PERMISSIONS.MANAGE_RESTAURANT)
    if (session instanceof NextResponse) return session

    const tenantId = getTenantIdFromSession(session)
    const body = await request.json()

    try {
        const { enableRestaurantMode, ...restaurantData } = body

        if (typeof enableRestaurantMode === 'boolean') {
            await masterPrisma.tenantSettings.upsert({
                where: { tenantId },
                create: { tenantId, enableRestaurantMode },
                update: { enableRestaurantMode },
            })
        }

        const hasRestaurantData = Object.keys(restaurantData).length > 0
        let config
        if (hasRestaurantData) {
            config = await updateRestaurantConfig(tenantId, restaurantData)
        } else {
            config = await getRestaurantConfig(tenantId)
        }

        const tenantSettings = await masterPrisma.tenantSettings.findUnique({
            where: { tenantId },
            select: { enableRestaurantMode: true },
        })

        return NextResponse.json({
            success: true,
            config: {
                ...config,
                enableRestaurantMode: tenantSettings?.enableRestaurantMode ?? false,
            },
        })
    } catch (error: any) {
        logger.error('Error in api/restaurant/config POST', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
