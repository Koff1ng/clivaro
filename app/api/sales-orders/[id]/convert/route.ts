import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/api-middleware'
import { PERMISSIONS } from '@/lib/permissions'
import { withTenantTx, getTenantIdFromSession } from '@/lib/tenancy'

export async function POST(
    request: Request,
    { params }: { params: { id: string } }
) {
    const session = await requirePermission(request as any, PERMISSIONS.MANAGE_SALES)
    if (session instanceof NextResponse) return session

    const tenantId = getTenantIdFromSession(session)
    const id = params.id

    return await withTenantTx(tenantId, async (tx: any) => {
        // 1. Get Sales Order
        const order = await tx.salesOrder.findUnique({
            where: { id },
            include: {
                items: true
            }
        })

        if (!order) {
            return NextResponse.json({ error: 'Orden de venta no encontrada' }, { status: 404 })
        }

        if (order.status !== 'OPEN') {
            return NextResponse.json({ error: 'Esta orden ya fue procesada o cancelada' }, { status: 400 })
        }

        // 2. Generate Invoice Number
        const count = await tx.invoice.count()
        // Ideally use tenant settings for prefix
        const invoiceNumber = `FV-${String(count + 1).padStart(6, '0')}`

        // 3. Create Invoice
        // IMPORTANT: Here we assume simple conversion.
        // If you need to select a warehouse, it should be passed in body. For now defaulting.
        // Assuming 'DEFAULT' warehouse or null for simplicity of this step, or we enforce warehouse selection in future.

        const invoice = await tx.invoice.create({
            data: {
                number: invoiceNumber,
                customerId: order.customerId,
                salesOrderId: order.id,
                status: 'EMITIDA', // Issued
                subtotal: order.subtotal,
                discount: order.discount,
                tax: order.tax,
                total: order.total,
                balance: order.total, // Starts unpaid
                notes: order.notes,
                createdById: (session.user as any).id,
                items: {
                    create: order.items.map((item: any) => ({
                        productId: item.productId,
                        variantId: item.variantId,
                        quantity: item.quantity,
                        unitPrice: item.unitPrice,
                        discount: item.discount,
                        taxRate: item.taxRate,
                        subtotal: item.subtotal
                    }))
                }
            }
        })

        // 4. Update Sales Order Status
        await tx.salesOrder.update({
            where: { id },
            data: {
                status: 'COMPLETED'
            }
        })

        // 5. Deduct Stock
        // This logic mimics the basic stock deduction. 
        // In a real multi-warehouse scenario, we need to know WHICH warehouse. 
        // For now, we'll try to find a default warehouse or rely on main logic.
        // Let's assume we deduct from the first found warehouse to avoid errors? 
        // OR BETTER: Don't implement stock deduction here explicitly if we don't have warehouse info.
        // BUT the requirement Says "Triggers Stock Deduction".

        // Simplification: Iterate items and decrement from the first available stock record? 
        // Better Simplification: We will deduct from the Warehouse ID passed in body, or default to first.

        // Let's read body for warehouseId
        let warehouseId = ''
        try {
            const body = await request.json().catch(() => ({}))
            warehouseId = body.warehouseId
        } catch (e) { }

        if (!warehouseId) {
            const w = await tx.warehouse.findFirst()
            if (w) warehouseId = w.id
        }

        if (warehouseId) {
            for (const item of order.items) {
                if (item.productId) {
                    // Decrease stock
                    // Using upsert or updateMany to handle specific warehouse stock
                    // Note: This needs to be robust. For now simple decrement.

                    // Check if stock record exists
                    const stock = await tx.stockLevel.findFirst({
                        where: { productId: item.productId, warehouseId, variantId: item.variantId }
                    })

                    if (stock) {
                        await tx.stockLevel.update({
                            where: { id: stock.id },
                            data: { quantity: { decrement: item.quantity } }
                        })
                    } else {
                        // Create negative stock? or 0? 
                        await tx.stockLevel.create({
                            data: {
                                productId: item.productId,
                                warehouseId,
                                variantId: item.variantId,
                                quantity: -item.quantity // Allow negative if allowed
                            }
                        })
                    }

                    // Log Movement
                    await tx.stockMovement.create({
                        data: {
                            type: 'OUT',
                            quantity: item.quantity,
                            productId: item.productId,
                            variantId: item.variantId,
                            warehouseId,
                            reason: `Venta Factura ${invoiceNumber}`,
                            reference: invoice.id,
                            createdById: (session.user as any).id
                        }
                    })
                }
            }
        }

        return NextResponse.json(invoice)
    })
}
