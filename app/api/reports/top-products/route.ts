import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/api-middleware'
import { PERMISSIONS } from '@/lib/permissions'
import { getPrismaForRequest } from '@/lib/get-tenant-prisma'
import { logger } from '@/lib/logger'

export async function GET(request: Request) {
    const session = await requirePermission(request as any, PERMISSIONS.VIEW_REPORTS)

    if (session instanceof NextResponse) {
        return session
    }

    const prisma = await getPrismaForRequest(request, session)
    const startTime = Date.now()

    try {
        const { searchParams } = new URL(request.url)
        const from = searchParams.get('from')
        const to = searchParams.get('to')
        const limit = parseInt(searchParams.get('limit') || '50')

        if (!from || !to) {
            return NextResponse.json(
                { error: 'Missing required parameters: from, to' },
                { status: 400 }
            )
        }

        const fromDate = new Date(from)
        const toDate = new Date(to)
        toDate.setHours(23, 59, 59, 999)

        // Fetch invoices
        const invoices = await prisma.invoice.findMany({
            where: {
                status: { in: ['PAID', 'PARTIAL'] },
                issuedAt: {
                    gte: fromDate,
                    lte: toDate,
                },
            },
            include: {
                items: {
                    include: {
                        product: {
                            select: {
                                id: true,
                                name: true,
                                sku: true,
                                cost: true,
                                category: true,
                            },
                        },
                    },
                },
            },
        })

        // Fetch returns
        const returns = await prisma.return.findMany({
            where: {
                status: 'COMPLETED',
                createdAt: {
                    gte: fromDate,
                    lte: toDate,
                },
            },
            include: {
                items: {
                    include: {
                        invoiceItem: {
                            include: {
                                product: true
                            }
                        }
                    }
                }
            }
        })

        const productStatsMap = new Map()

        // Process Sales
        invoices.forEach(inv => {
            inv.items.forEach(item => {
                const id = item.productId
                if (!id) return

                const stats = productStatsMap.get(id) || {
                    id,
                    name: item.product?.name || 'Unknown',
                    sku: item.product?.sku || '',
                    category: item.product?.category || 'Sin categoría',
                    quantity: 0,
                    revenue: 0,
                    cost: 0,
                    profit: 0
                }

                stats.quantity += item.quantity
                stats.revenue += item.subtotal // Net revenue
                stats.cost += (item.product?.cost || 0) * item.quantity
                productStatsMap.set(id, stats)
            })
        })

        // Deduct Returns
        returns.forEach(ret => {
            ret.items.forEach(ri => {
                const id = ri.invoiceItem?.productId
                if (!id) return

                const stats = productStatsMap.get(id)
                if (stats) {
                    const taxRate = ri.invoiceItem?.taxRate || 0
                    const netReturn = ri.total / (1 + (taxRate / 100))

                    stats.quantity -= ri.quantity
                    stats.revenue -= netReturn
                    stats.cost -= (ri.invoiceItem.product?.cost || 0) * ri.quantity
                }
            })
        })

        const products = Array.from(productStatsMap.values())
            .map(p => ({
                ...p,
                profit: p.revenue - p.cost
            }))
            .sort((a, b) => b.revenue - a.revenue)
            .slice(0, limit)

        const result = {
            products,
            summary: {
                totalQuantity: products.reduce((sum, p) => sum + p.quantity, 0),
                totalRevenue: products.reduce((sum, p) => sum + p.revenue, 0),
                totalProfit: products.reduce((sum, p) => sum + p.profit, 0),
            }
        }

        const duration = Date.now() - startTime
        logger.apiResponse('GET', '/api/reports/top-products', 200, duration)

        return NextResponse.json(result)
    } catch (error: any) {
        logger.error('Error fetching top products report', error, {
            endpoint: '/api/reports/top-products',
        })
        return NextResponse.json(
            { error: error?.message || 'Failed to fetch report' },
            { status: 500 }
        )
    }
}
