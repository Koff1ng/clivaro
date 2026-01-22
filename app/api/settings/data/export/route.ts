import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import * as XLSX from 'xlsx'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
    try {
        const session = await getServerSession(authOptions)
        const user = session?.user as any
        if (!user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { entities, format } = await req.json()

        const wb = XLSX.utils.book_new()
        const jsonResult: Record<string, any[]> = {}

        // CLIENTS
        if (entities.includes('clients')) {
            const clients = await prisma.customer.findMany({
                select: {
                    id: true,
                    name: true,
                    taxId: true,
                    email: true,
                    phone: true,
                    address: true,
                    tags: true,
                    notes: true,
                    active: true,
                    createdAt: true
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
                select: {
                    id: true,
                    sku: true,
                    barcode: true,
                    name: true,
                    brand: true,
                    category: true,
                    unitOfMeasure: true,
                    cost: true,
                    price: true,
                    taxRate: true,
                    trackStock: true,
                    active: true,
                    description: true,
                    createdAt: true
                }
            })

            if (format === 'json') {
                jsonResult['products'] = products
            } else {
                const ws = XLSX.utils.json_to_sheet(products)
                XLSX.utils.book_append_sheet(wb, ws, "Productos")
            }
        }

        // SALES
        if (entities.includes('sales')) {
            const sales = await prisma.invoice.findMany({
                include: {
                    customer: { select: { name: true } },
                    items: {
                        include: { product: { select: { name: true, sku: true } } }
                    }
                },
                orderBy: { createdAt: 'desc' },
                take: 1000 // Limit for safety
            })

            // Flat items for Excel export
            const flatSales = sales.flatMap((sale: any) =>
                sale.items.map((item: any) => ({
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
                    'Content-Disposition': `attachment; filename="backup-${new Date().toISOString().split('T')[0]}.json"`
                }
            })
        } else {
            // Generate Buffer
            const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

            return new NextResponse(buf, {
                headers: {
                    'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                    'Content-Disposition': `attachment; filename="backup-${new Date().toISOString().split('T')[0]}.xlsx"`
                }
            })
        }

    } catch (error: any) {
        console.error('Export Error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
