import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/api-middleware'
import { PERMISSIONS } from '@/lib/permissions'
import { withTenantTx, getTenantIdFromSession } from '@/lib/tenancy'
import { updateStockLevel } from '@/lib/inventory'
import { logActivity } from '@/lib/activity'

export async function POST(
    request: Request,
    { params }: { params: { id: string } }
) {
    const session = await requirePermission(request as any, PERMISSIONS.MANAGE_INVENTORY)
    if (session instanceof NextResponse) return session

    const tenantId = getTenantIdFromSession(session)

    try {
        const result = await withTenantTx(tenantId, async (tx: any) => {
            const inventory = await tx.physicalInventory.findUnique({
                where: { id: params.id },
                include: { items: true }
            })

            if (!inventory) {
                throw new Error('Inventario físico no encontrado')
            }

            if (inventory.status !== 'COMPLETED') {
                throw new Error('Solo se pueden aprobar inventarios en estado COMPLETADO')
            }

            // Procesar ajustes de stock
            let adjustedCount = 0
            for (const item of inventory.items) {
                if (item.difference !== 0 && item.difference !== null) {
                    await updateStockLevel(
                        inventory.warehouseId,
                        item.productId,
                        item.variantId,
                        item.difference,
                        tx,
                        {
                            type: 'ADJUSTMENT',
                            zoneId: item.zoneId || undefined,
                            reason: `Aprobación de inventario físico ${inventory.number}`,
                            reference: inventory.number,
                            createdById: (session.user as any).id
                        }
                    )
                    adjustedCount++
                }
            }

            // Actualizar estado del inventario
            const updated = await tx.physicalInventory.update({
                where: { id: params.id },
                data: {
                    status: 'APPROVED',
                    approvedAt: new Date(),
                    approvedById: (session.user as any).id
                },
                include: {
                    warehouse: { select: { id: true, name: true } },
                    approvedBy: { select: { id: true, name: true } }
                }
            })

            // Log de actividad
            await logActivity({
                prisma: tx,
                type: 'INVENTORY_PHYSICAL',
                subject: `Inventario Físico Aprobado: ${inventory.number}`,
                description: `Se aplicaron ajustes de stock a ${adjustedCount} productos.`,
                userId: (session.user as any).id,
                metadata: { inventoryId: inventory.id }
            })

            return updated
        })

        return NextResponse.json(result)
    } catch (error: any) {
        console.error('Error approving physical inventory:', error)
        return NextResponse.json({ error: error.message || 'Failed to approve inventory' }, { status: 500 })
    }
}
