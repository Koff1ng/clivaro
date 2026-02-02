import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/api-middleware'
import { PERMISSIONS } from '@/lib/permissions'
import { withTenantTx, getTenantIdFromSession } from '@/lib/tenancy'
import { z } from 'zod'

const updateZoneSchema = z.object({
    name: z.string().min(1).optional(),
    description: z.string().optional().nullable(),
    active: z.boolean().optional(),
})

export async function PUT(
    request: Request,
    { params }: { params: { id: string, zoneId: string } }
) {
    const session = await requirePermission(request as any, PERMISSIONS.MANAGE_INVENTORY)
    if (session instanceof NextResponse) return session

    const tenantId = getTenantIdFromSession(session)

    try {
        const body = await request.json()
        const data = updateZoneSchema.parse(body)

        const zone = await withTenantTx(tenantId, async (tx) => {
            // Verificar si existe la zona
            const existing = await tx.warehouseZone.findUnique({
                where: { id: params.zoneId }
            })

            if (!existing || existing.warehouseId !== params.id) {
                throw new Error('Zona no encontrada en este almacén')
            }

            return await tx.warehouseZone.update({
                where: { id: params.zoneId },
                data,
            })
        })

        return NextResponse.json(zone)
    } catch (error: any) {
        console.error('Error updating zone:', error)
        if (error instanceof z.ZodError) {
            return NextResponse.json({ error: 'Error de validación', details: error.errors }, { status: 400 })
        }
        return NextResponse.json({ error: error.message || 'Failed to update zone' }, { status: 500 })
    }
}

export async function DELETE(
    request: Request,
    { params }: { params: { id: string, zoneId: string } }
) {
    const session = await requirePermission(request as any, PERMISSIONS.MANAGE_INVENTORY)
    if (session instanceof NextResponse) return session

    const tenantId = getTenantIdFromSession(session)

    try {
        await withTenantTx(tenantId, async (tx) => {
            // Verificar dependencias (stock levels)
            const stockLevels = await tx.stockLevel.count({
                where: { zoneId: params.zoneId, quantity: { gt: 0 } }
            })

            if (stockLevels > 0) {
                throw new Error('No se puede eliminar la zona porque tiene productos con existencias')
            }

            // Proceder a eliminar
            return await tx.warehouseZone.delete({
                where: { id: params.zoneId }
            })
        })

        return NextResponse.json({ success: true })
    } catch (error: any) {
        console.error('Error deleting zone:', error)
        return NextResponse.json({ error: error.message || 'Failed to delete zone' }, { status: 500 })
    }
}
