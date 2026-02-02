import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/api-middleware'
import { PERMISSIONS } from '@/lib/permissions'
import { logger } from '@/lib/logger'
import { withTenantTx } from '@/lib/tenancy'
import { handleError } from '@/lib/error-handler'

export async function GET(request: Request) {
    const session = await requirePermission(request as any, PERMISSIONS.VIEW_REPORTS)

    if (session instanceof NextResponse) {
        return session
    }

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

        return await withTenantTx(session.user.tenantId, async (prisma) => {
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

            // Fetch returns in the date range with items and original taxes
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
                            invoiceItem: true
                        }
                    }
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

            // Deduct returns with precision
            let totalReturns = 0
            let totalTaxReturns = 0

            returns.forEach(ret => {
                totalReturns += ret.total
                ret.items.forEach((ri: any) => {
                    const taxRate = ri.invoiceItem?.taxRate || 0
                    const netReturnItem = ri.total / (1 + (taxRate / 100))
                    totalTaxReturns += (ri.total - netReturnItem)
                })
            })

            const finalGrossSales = totalGrossSales - totalReturns
            const finalNetSales = totalNetSales - (totalReturns - totalTaxReturns)
            const finalTax = totalTax - totalTaxReturns

            const totalProfit = finalNetSales - totalCost
            const profitMargin = finalNetSales > 0 ? (totalProfit / finalNetSales) * 100 : 0

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

                    let dailyTaxRet = 0
                    ret.items.forEach((ri: any) => {
                        const taxRate = ri.invoiceItem?.taxRate || 0
                        dailyTaxRet += (ri.total - (ri.total / (1 + (taxRate / 100))))
                    })
                    stats.netSales -= (ret.total - dailyTaxRet)
                }
            })

            // Top products calculation
            const productStatsMap = new Map()
            invoices.forEach(inv => {
                inv.items.forEach(item => {
                    const id = item.productId
                    const revenue = item.subtotal
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

            // Payment Methods
            const paymentMethods: any = {}
            invoices.forEach(inv => {
                inv.payments.forEach(p => {
                    paymentMethods[p.method] = (paymentMethods[p.method] || 0) + p.amount
                })
            })

            // Seller stats
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
                    totalSales: finalGrossSales,
                    totalNetSales: finalNetSales,
                    totalTax: finalTax,
                    totalCost,
                    totalProfit,
                    profitMargin,
                    totalInvoices: invoices.length,
                    averageValue: invoices.length > 0 ? finalGrossSales / invoices.length : 0,
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
        })
    } catch (error: any) {
        return handleError(error, 'GET /api/reports/sales-by-period')
    }
}
