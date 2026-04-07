import { NextResponse } from 'next/server'
import { getTenantIdFromSession, withTenantTx } from '@/lib/tenancy'
import { requirePermission } from '@/lib/api-middleware'
import { PERMISSIONS } from '@/lib/permissions'
import { logger } from '@/lib/logger'
import { ensureRestaurantMode } from '@/lib/restaurant'

export const dynamic = 'force-dynamic'

/**
 * PATCH: Actualiza una zona de restaurante.
 */
export async function PATCH(
    request: Request,
    { params }: { params: { id: string } }
) {
    const session = await requirePermission(request as any, PERMISSIONS.MANAGE_RESTAURANT)
    if (session instanceof NextResponse) return session

    const tenantId = getTenantIdFromSession(session)
    const { name, description, active } = await request.json()
    const { id } = params

    // Validar que el modo restaurante esté activo
    const errorResponse = await ensureRestaurantMode(tenantId)
    if (errorResponse) return errorResponse

    try {
        const zone = await withTenantTx(tenantId, async (tx) => {
            return await tx.restaurantZone.update({
                where: { id },
                data: {
                    ...(name && { name }),
                    ...(description !== undefined && { description }),
                    ...(active !== undefined && { active }),
                }
            })
        })
        return NextResponse.json(zone)
    } catch (error: any) {
        logger.error(`Error in api/restaurant/zones/${id} PATCH`, error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}

/**
 * DELETE: Elimina una zona de restaurante.
 */
export async function DELETE(
    request: Request,
    { params }: { params: { id: string } }
) {
    const session = await requirePermission(request as any, PERMISSIONS.MANAGE_RESTAURANT)
    if (session instanceof NextResponse) return session

    const tenantId = getTenantIdFromSession(session)
    const { id } = params

    // Validar que el modo restaurante esté activo
    const errorResponse = await ensureRestaurantMode(tenantId)
    if (errorResponse) return errorResponse

    try {
        await withTenantTx(tenantId, async (tx) => {
            // Verificar si tiene mesas
            const tableCount = await tx.restaurantTable.count({
                where: { zoneId: id }
            })

            if (tableCount > 0) {
                throw new Error('No se puede eliminar una zona que contiene mesas. Elimina las mesas primero.')
            }

            return await tx.restaurantZone.delete({
                where: { id }
            })
        })
        return NextResponse.json({ success: true })
    } catch (error: any) {
        logger.error(`Error in api/restaurant/zones/${id} DELETE`, error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
