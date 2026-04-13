import { NextResponse } from 'next/server'
import { getTenantIdFromSession, withTenantRead, withTenantTx } from '@/lib/tenancy'
import { requirePermission, requireAnyPermission } from '@/lib/api-middleware'
import { PERMISSIONS } from '@/lib/permissions'
import { logger } from '@/lib/logger'
import { ensureRestaurantMode, hashPin } from '@/lib/restaurant'

export const dynamic = 'force-dynamic'
import { safeErrorMessage } from '@/lib/safe-error'

/**
 * GET: Lista todos los meseros.
 */
export async function GET(request: Request) {
    const session = await requireAnyPermission(request as any, [
        PERMISSIONS.MANAGE_RESTAURANT,
        PERMISSIONS.MANAGE_SALES,
        PERMISSIONS.MANAGE_CASH,
    ])
    if (session instanceof NextResponse) return session

    const tenantId = getTenantIdFromSession(session)

    // Validar que el modo restaurante esté activo
    const errorResponse = await ensureRestaurantMode(tenantId)
    if (errorResponse) return errorResponse

    try {
        const waiters = await withTenantRead(tenantId, async (tx) => {
            return await tx.waiterProfile.findMany({
                where: { active: true },
                orderBy: { name: 'asc' },
                select: {
                    id: true,
                    name: true,
                    code: true,
                    lastLogin: true,
                    createdAt: true,
                }
            })
        })
        return NextResponse.json(waiters)
    } catch (error: any) {
        logger.error('Error in api/restaurant/waiters GET', error)
        return NextResponse.json({ error: safeErrorMessage(error) }, { status: 500 })
    }
}

/**
 * POST: Crea un nuevo perfil de mesero.
 */
export async function POST(request: Request) {
    const session = await requirePermission(request as any, PERMISSIONS.MANAGE_RESTAURANT)
    if (session instanceof NextResponse) return session

    const tenantId = getTenantIdFromSession(session)
    const { name, code, pin } = await request.json()

    if (!name || !code || !pin) {
        return NextResponse.json({ error: 'Nombre, código y PIN son obligatorios' }, { status: 400 })
    }

    // Validar que el modo restaurante esté activo
    const errorResponse = await ensureRestaurantMode(tenantId)
    if (errorResponse) return errorResponse

    try {
        const waiter = await withTenantTx(tenantId, async (tx) => {
            return await tx.waiterProfile.create({
                data: {
                    tenantId,
                    name,
                    code,
                    pin: hashPin(pin),
                }
            })
        })
        
        const { pin: _, ...waiterWithoutPin } = waiter as any
        return NextResponse.json(waiterWithoutPin)
    } catch (error: any) {
        logger.error('Error in api/restaurant/waiters POST', error)
        return NextResponse.json({ error: safeErrorMessage(error) }, { status: 500 })
    }
}
