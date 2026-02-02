import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/api-middleware'
import { PERMISSIONS } from '@/lib/permissions'
import { withTenantTx, getTenantIdFromSession } from '@/lib/tenancy'
import { z } from 'zod'

const updateSalesOrderSchema = z.object({
    notes: z.string().optional().nullable(),
    items: z.array(z.object({
        productId: z.string().min(1),
        variantId: z.string().optional().nullable(),
        quantity: z.number().min(0.01),
        unitPrice: z.number().min(0),
        discount: z.number().min(0).default(0),
        taxRate: z.number().min(0).default(0),
    })).min(1, 'Debe agregar al menos un producto'),
})

export async function GET(
    request: Request,
    { params }: { params: { id: string } }
) {
    const session = await requirePermission(request as any, PERMISSIONS.MANAGE_SALES)
    if (session instanceof NextResponse) return session

    const tenantId = getTenantIdFromSession(session)
    const id = params.id

    return await withTenantTx(tenantId, async (tx: any) => {
        const order = await tx.salesOrder.findUnique({
            where: { id },
            include: {
                customer: true,
                items: {
                    include: {
                        product: true,
                        variant: true
                    }
                },
                quotation: true,
                created_by: { select: { name: true, email: true } }
            }
        })

        if (!order) {
            return NextResponse.json({ error: 'Orden de venta no encontrada' }, { status: 404 })
        }

        return NextResponse.json(order)
    })
}

export async function PUT(
    request: Request,
    { params }: { params: { id: string } }
) {
    const session = await requirePermission(request as any, PERMISSIONS.MANAGE_SALES)
    if (session instanceof NextResponse) return session

    const tenantId = getTenantIdFromSession(session)
    const id = params.id

    try {
        const body = await request.json()
        const data = updateSalesOrderSchema.parse(body)

        return await withTenantTx(tenantId, async (tx: any) => {
            const order = await tx.salesOrder.findUnique({ where: { id } })
            if (!order) return NextResponse.json({ error: 'Orden no encontrada' }, { status: 404 })

            if (order.status !== 'OPEN') {
                return NextResponse.json({ error: 'Solo se pueden editar órdenes en estado ABIERTO' }, { status: 400 })
            }

            // Recalculate totals
            let subtotal = 0
            let totalTax = 0
            let totalDiscount = 0

            const itemsData = data.items.map((item) => {
                const lineSubtotalRaw = item.quantity * item.unitPrice
                const lineDiscount = lineSubtotalRaw * (item.discount / 100)
                const lineTax = (lineSubtotalRaw - lineDiscount) * (item.taxRate / 100)

                subtotal += lineSubtotalRaw
                totalDiscount += lineDiscount
                totalTax += lineTax

                return {
                    productId: item.productId,
                    variantId: item.variantId,
                    quantity: item.quantity,
                    unitPrice: item.unitPrice,
                    discount: item.discount,
                    taxRate: item.taxRate,
                    subtotal: lineSubtotalRaw - lineDiscount + lineTax
                }
            })

            const total = subtotal - totalDiscount + totalTax

            // Delete existing and recreate items
            // (Simple strategy for update)
            await tx.salesOrderItem.deleteMany({ where: { salesOrderId: id } })

            const updated = await tx.salesOrder.update({
                where: { id },
                data: {
                    subtotal,
                    discount: totalDiscount,
                    tax: totalTax,
                    total,
                    notes: data.notes,
                    updatedById: (session.user as any).id,
                    items: {
                        create: itemsData
                    }
                }
            })

            return NextResponse.json(updated)
        })
    } catch (error: any) {
        if (error instanceof z.ZodError) {
            return NextResponse.json({ error: 'Validación fallida', details: error.errors }, { status: 400 })
        }
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}

export async function DELETE(
    request: Request,
    { params }: { params: { id: string } }
) {
    const session = await requirePermission(request as any, PERMISSIONS.MANAGE_SALES)
    if (session instanceof NextResponse) return session

    const tenantId = getTenantIdFromSession(session)

    return await withTenantTx(tenantId, async (tx: any) => {
        const order = await tx.salesOrder.findUnique({ where: { id: params.id } })

        if (!order) return NextResponse.json({ error: 'Orden no encontrada' }, { status: 404 })
        if (order.status !== 'OPEN') {
            return NextResponse.json({ error: 'Solo se pueden cancelar órdenes ABIERTAS' }, { status: 400 })
        }

        const updated = await tx.salesOrder.update({
            where: { id: params.id },
            data: { status: 'CANCELLED' }
        })

        return NextResponse.json(updated)
    })
}
