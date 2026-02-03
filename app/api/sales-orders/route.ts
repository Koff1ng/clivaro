import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/api-middleware'
import { PERMISSIONS } from '@/lib/permissions'
import { withTenantTx, getTenantIdFromSession } from '@/lib/tenancy'
import { z } from 'zod'

const createSalesOrderSchema = z.object({
    customerId: z.string().min(1, 'El cliente es requerido'),
    quotationId: z.string().optional().nullable(),
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

export async function GET(request: Request) {
    const session = await requirePermission(request as any, PERMISSIONS.MANAGE_SALES)
    if (session instanceof NextResponse) return session

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')
    const search = searchParams.get('search') || ''
    const status = searchParams.get('status')
    const customerId = searchParams.get('customerId')

    const tenantId = getTenantIdFromSession(session)

    return await withTenantTx(tenantId, async (tx: any) => {
        const where: any = {}

        if (search) {
            where.OR = [
                { number: { contains: search, mode: 'insensitive' } },
                { customer: { name: { contains: search, mode: 'insensitive' } } },
            ]
        }

        if (status) {
            where.status = status
        }

        if (customerId) {
            where.customerId = customerId
        }

        const [items, total] = await Promise.all([
            tx.salesOrder.findMany({
                where,
                include: {
                    customer: { select: { id: true, name: true } },
                    _count: { select: { items: true } }
                },
                orderBy: { createdAt: 'desc' },
                skip: (page - 1) * limit,
                take: limit,
            }),
            tx.salesOrder.count({ where }),
        ])

        return NextResponse.json({
            items,
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
        })
    })
}

export async function POST(request: Request) {
    const session = await requirePermission(request as any, PERMISSIONS.MANAGE_SALES)
    if (session instanceof NextResponse) return session

    const tenantId = getTenantIdFromSession(session)

    try {
        const body = await request.json()
        const data = createSalesOrderSchema.parse(body)

        return await withTenantTx(tenantId, async (tx: any) => {
            // 1. Generate Number (Simple auto-increment logic or similar - here using timestamp/random/count for simplicity or rely on DB defaults if advanced)
            // Ideally we would fetch prefix/sequence from settings
            const count = await tx.salesOrder.count()
            const number = `OC-${String(count + 1).padStart(6, '0')}`

            // 2. Calculate Totals
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

            // 3. Create Sales Order
            const salesOrder = await tx.salesOrder.create({
                data: {
                    number,
                    customerId: data.customerId,
                    quotationId: data.quotationId, // Optional link
                    status: 'OPEN',
                    subtotal,
                    discount: totalDiscount,
                    tax: totalTax,
                    total,
                    notes: data.notes,
                    createdById: (session.user as any).id,
                    items: {
                        create: itemsData
                    }
                },
                include: {
                    items: {
                        include: {
                            product: true,
                            variant: true
                        }
                    }
                }
            })

            return NextResponse.json(salesOrder, { status: 201 })
        })

    } catch (error: any) {
        if (error instanceof z.ZodError) {
            return NextResponse.json({ error: 'Validación fallida', details: error.errors }, { status: 400 })
        }
        return NextResponse.json({ error: error.message || 'Error al crear la orden de venta' }, { status: 500 })
    }
}
