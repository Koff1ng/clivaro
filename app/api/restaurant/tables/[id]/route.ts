import { NextResponse } from 'next/server'
import { getTenantIdFromSession, withTenantTx } from '@/lib/tenancy'
import { requirePermission } from '@/lib/api-middleware'
import { PERMISSIONS } from '@/lib/permissions'
import { logger } from '@/lib/logger'
import { ensureRestaurantMode } from '@/lib/restaurant'
import { emitRestaurantEvent, RESTAURANT_EVENTS } from '@/lib/events'

export const dynamic = 'force-dynamic'
import { safeErrorMessage } from '@/lib/safe-error'

/**
 * PATCH: Actualiza una mesa (nombre, capacidad, posición, estado).
 */
export async function PATCH(
    request: Request,
    { params }: { params: { id: string } }
) {
    const session = await requirePermission(request as any, PERMISSIONS.MANAGE_RESTAURANT)
    if (session instanceof NextResponse) return session

    const tenantId = getTenantIdFromSession(session)
    const data = await request.json()
    const { id } = params

    // Validar que el modo restaurante esté activo
    const errorResponse = await ensureRestaurantMode(tenantId)
    if (errorResponse) return errorResponse

    try {
        const table = await withTenantTx(tenantId, async (tx) => {
            return await tx.restaurantTable.update({
                where: { id },
                data: {
                    ...(data.name && { name: data.name }),
                    ...(data.capacity !== undefined && { capacity: data.capacity }),
                    ...(data.status && { status: data.status }),
                    ...(data.x !== undefined && { x: data.x }),
                    ...(data.y !== undefined && { y: data.y }),
                    ...(data.active !== undefined && { active: data.active }),
                }
            })
        })

        // Emitir evento en tiempo real
        emitRestaurantEvent(tenantId, RESTAURANT_EVENTS.TABLE_UPDATED, {
            id: table.id,
            status: table.status,
            x: table.x,
            y: table.y,
            name: table.name,
            zoneId: table.zoneId
        })

        return NextResponse.json(table)
    } catch (error: any) {
        logger.error(`Error in api/restaurant/tables/${id} PATCH`, error)
        return NextResponse.json({ error: safeErrorMessage(error) }, { status: 500 })
    }
}

/**
 * DELETE: Elimina una mesa de restaurante.
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
            // Aquí podríamos validar si tiene una sesión activa en el futuro
            return await tx.restaurantTable.delete({
                where: { id }
            })
        })

        // Notificar eliminación
        emitRestaurantEvent(tenantId, RESTAURANT_EVENTS.TABLE_UPDATED, {
            id,
            isDeleted: true
        })

        return NextResponse.json({ success: true })
    } catch (error: any) {
        logger.error(`Error in api/restaurant/tables/${id} DELETE`, error)
        return NextResponse.json({ error: safeErrorMessage(error) }, { status: 500 })
    }
}
