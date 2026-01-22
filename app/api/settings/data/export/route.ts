import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import prisma from '@/lib/prisma'
import * as XLSX from 'xlsx'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
    try {
        const session = await auth()
        if (!session?.user?.id || !session?.user?.tenantId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { entities, format } = await req.json()
        const tenantId = session.user.tenantId

        const wb = XLSX.utils.book_new()
        const jsonResult: Record<string, any[]> = {}

        // CLIENTS
        if (entities.includes('clients')) {
            const clients = await prisma.customer.findMany({
                where: { tenantId },
                select: {
                    id: true, name: true, taxId: true, email: true, phone: true, address: true, city: true, type: true, createdAt: true
                }
            })
            if (format === 'json') {
                jsonResult['clients'] = clients
            } else {
                const ws = XLSX.utils.json_to_sheet(clients)
                XLSX.utils.book_append_sheet(wb, ws, "Clientes")
            }
        }

        // PRODUCTS
        if (entities.includes('products')) {
            const products = await prisma.product.findMany({
                where: { tenantId },
                include: { category: { select: { name: true } }, brand: { select: { name: true } } }
            })
            const flatProducts = products.map(p => ({
                ...p,
                categoryName: p.category?.name || '',
                brandName: p.brand?.name || '',
                category: undefined,
                brand: undefined
            }))

            if (format === 'json') {
                jsonResult['products'] = flatProducts
            } else {
                const ws = XLSX.utils.json_to_sheet(flatProducts)
                XLSX.utils.book_append_sheet(wb, ws, "Productos")
            }
        }

        // SALES
        if (entities.includes('sales')) {
            const sales = await prisma.invoice.findMany({
                where: { tenantId },
                include: {
                    customer: { select: { name: true } },
                    items: {
                        include: { product: { select: { name: true, sku: true } } }
                    }
                },
                orderBy: { createdAt: 'desc' },
                take: 1000 // Limit for safety
            })

            // For Excel, we might want one row per invoice or per item. 
            // Let's do simple header per invoice for now, or flat items.
            // Doing flat items is usually better for analysis
            const flatSales = sales.flatMap(sale =>
                sale.items.map(item => ({
                    invoiceNumber: sale.number,
                    date: sale.issuedAt,
                    customer: sale.customer?.name,
                    total: sale.total,
                    status: sale.status,
                    sku: item.product?.sku,
                    product: item.product?.name,
                    quantity: item.quantity,
                    price: item.unitPrice,
                    subtotal: item.subtotal
                }))
            )

            if (format === 'json') {
                jsonResult['sales'] = sales // Full nested structure for JSON
            } else {
                const ws = XLSX.utils.json_to_sheet(flatSales)
                XLSX.utils.book_append_sheet(wb, ws, "Ventas_Items")
            }
        }

        if (format === 'json') {
            return new NextResponse(JSON.stringify(jsonResult, null, 2), {
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Disposition': `attachment; filename="backup-${tenantId}.json"`
                }
            })
        } else {
            // Generate Buffer
            const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

            return new NextResponse(buf, {
                headers: {
                    'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                    'Content-Disposition': `attachment; filename="backup-${tenantId}.xlsx"`
                }
            })
        }

    } catch (error: any) {
        console.error('Export Error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
