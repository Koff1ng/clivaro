import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/api-middleware'
import { PERMISSIONS } from '@/lib/permissions'
import { withTenantTx, getTenantIdFromSession } from '@/lib/tenancy'
import { createJournalEntryFromInvoice } from '@/lib/accounting/invoice-integration'
import { createCostOfSalesEntry } from '@/lib/accounting/inventory-integration'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

export async function POST(
    request: Request,
    { params }: { params: { id: string } }
) {
    const session = await requirePermission(request as any, PERMISSIONS.MANAGE_SALES)
    if (session instanceof NextResponse) return session

    const tenantId = getTenantIdFromSession(session)
    const id = params.id

    // Read body for warehouseId
    const body = await request.json().catch(() => ({}))
    const warehouseId = body.warehouseId

    if (!warehouseId) {
        return NextResponse.json({ error: 'Debe seleccionar una bodega para procesar la salida de inventario' }, { status: 400 })
    }

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

        // 5. Deduct Stock & Log Movement
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

        // 6. Integrate with Accounting
        try {
            // Generate Journal Entry for Revenue & AR
            await createJournalEntryFromInvoice(invoice.id, tenantId, (session.user as any).id, tx)

            // Generate Cost of Sales Entry
            await createCostOfSalesEntry(invoice.id, tenantId, (session.user as any).id, tx)
        } catch (accError: any) {
            logger.error('Error in accounting integration during conversion', accError)
            // Depending on policy, we might want to fail the whole Tx or just log.
            // Professional ERP: Fail the Tx to ensure consistency.
            throw new Error(`Error en integración contable: ${accError.message}`)
        }

        return NextResponse.json(invoice)
    })
}
