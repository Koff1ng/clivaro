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

        if (!from || !to) {
            return NextResponse.json(
                { error: 'Missing required parameters: from, to' },
                { status: 400 }
            )
        }

        const fromDate = new Date(from)
        const toDate = new Date(to)
        toDate.setHours(23, 59, 59, 999)

        // Fetch invoices in the date range
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
                                cost: true,
                                category: true,
                            },
                        },
                    },
                },
                payments: {
                    select: {
                        method: true,
                        amount: true,
                    },
                },
                createdBy: {
                    select: { name: true }
                }
            },
            orderBy: {
                issuedAt: 'asc',
            },
        })

        // Fetch returns in the date range
        const returns = await prisma.return.findMany({
            where: {
                status: 'COMPLETED',
                createdAt: {
                    gte: fromDate,
                    lte: toDate,
                },
            },
            include: {
                items: true
            }
        })

        // Metrics aggregation
        let totalGrossSales = 0
        let totalTax = 0
        let totalNetSales = 0
        let totalCost = 0
        let totalDiscounts = 0

        invoices.forEach(inv => {
            totalGrossSales += inv.total
            totalTax += inv.tax
            totalDiscounts += inv.discount
            totalNetSales += (inv.total - inv.tax)

            inv.items.forEach(item => {
                totalCost += (item.product?.cost || 0) * item.quantity
            })
        })

        // Deduct returns
        const totalReturns = returns.reduce((sum, ret) => sum + ret.total, 0)
        // Approximate tax deduction for returns if not stored separately in Return model
        // In this schema Return has total, we'll assume proportional tax for now or just deduct from gross
        totalGrossSales -= totalReturns
        // For simplicity in this logic fix, we deduct from net sales too (approx)
        totalNetSales -= totalReturns * 0.84 // Assuming ~19% tax roughly if missing, but let's be more precise if possible

        const totalProfit = totalNetSales - totalCost
        const profitMargin = totalNetSales > 0 ? (totalProfit / totalNetSales) * 100 : 0

        // Sales by day (filling gaps)
        const dailyMap = new Map()
        let curr = new Date(fromDate)
        while (curr <= toDate) {
            const d = curr.toISOString().split('T')[0]
            dailyMap.set(d, { date: d, sales: 0, count: 0, netSales: 0 })
            curr.setDate(curr.getDate() + 1)
        }

        invoices.forEach(inv => {
            if (!inv.issuedAt) return
            const day = inv.issuedAt.toISOString().split('T')[0]
            const stats = dailyMap.get(day)
            if (stats) {
                stats.sales += inv.total
                stats.netSales += (inv.total - inv.tax)
                stats.count += 1
            }
        })

        // Deduct returns from daily
        returns.forEach(ret => {
            const day = ret.createdAt.toISOString().split('T')[0]
            const stats = dailyMap.get(day)
            if (stats) {
                stats.sales -= ret.total
                stats.netSales -= ret.total * 0.84
            }
        })

        // Top products calculation fix
        const productStatsMap = new Map()
        invoices.forEach(inv => {
            inv.items.forEach(item => {
                const id = item.productId
                const revenue = item.subtotal // subtotal is net of line discount
                const cost = (item.product?.cost || 0) * item.quantity

                if (productStatsMap.has(id)) {
                    const p = productStatsMap.get(id)
                    p.quantity += item.quantity
                    p.revenue += revenue
                    p.cost += cost
                } else {
                    productStatsMap.set(id, {
                        id,
                        name: item.product?.name || 'Unknown',
                        category: item.product?.category,
                        quantity: item.quantity,
                        revenue,
                        cost
                    })
                }
            })
        })

        const topProducts = Array.from(productStatsMap.values())
            .map(p => ({ ...p, profit: p.revenue - p.cost }))
            .sort((a, b) => b.revenue - a.revenue)
            .slice(0, 20)

        // Payment Methods fix
        const paymentMethods: any = {}
        invoices.forEach(inv => {
            inv.payments.forEach(p => {
                paymentMethods[p.method] = (paymentMethods[p.method] || 0) + p.amount
            })
        })

        // Seller stats fix
        const sellerStatsMap = new Map()
        invoices.forEach(inv => {
            if (!inv.createdBy) return
            const id = inv.createdById
            if (sellerStatsMap.has(id)) {
                const s = sellerStatsMap.get(id)
                s.sales += inv.total
                s.count += 1
            } else {
                sellerStatsMap.set(id, {
                    sellerId: id,
                    sellerName: inv.createdBy.name,
                    sales: inv.total,
                    count: 1
                })
            }
        })

        const result = {
            summary: {
                totalSales: totalGrossSales,
                totalNetSales,
                totalTax,
                totalCost,
                totalProfit,
                profitMargin,
                totalInvoices: invoices.length,
                averageValue: invoices.length > 0 ? totalGrossSales / invoices.length : 0,
                totalReturns,
                totalDiscounts
            },
            salesByDay: Array.from(dailyMap.values()),
            salesByPaymentMethod: paymentMethods,
            topProducts,
            salesBySeller: Array.from(sellerStatsMap.values()).sort((a, b) => b.sales - a.sales)
        }

        const duration = Date.now() - startTime
        logger.apiResponse('GET', '/api/reports/sales-by-period', 200, duration)

        return NextResponse.json(result)
    } catch (error: any) {
        logger.error('Error fetching sales by period report', error, {
            endpoint: '/api/reports/sales-by-period',
        })
        return NextResponse.json(
            { error: error?.message || 'Failed to fetch report' },
            { status: 500 }
        )
    }
}
