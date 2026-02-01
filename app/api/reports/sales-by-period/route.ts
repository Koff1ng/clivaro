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
                customer: {
                    select: {
                        id: true,
                        name: true,
                    },
                },
                createdBy: {
                    select: {
                        id: true,
                        name: true,
                    },
                },
                payments: {
                    select: {
                        method: true,
                        amount: true,
                    },
                },
            },
            orderBy: {
                issuedAt: 'desc',
            },
        })

        // Calculate summary statistics
        const totalSales = invoices.reduce((sum, inv) => sum + inv.total, 0)
        const totalCost = invoices.reduce((sum, inv) => {
            const invoiceCost = inv.items.reduce((itemSum, item) => {
                return itemSum + (item.product?.cost || 0) * item.quantity
            }, 0)
            return sum + invoiceCost
        }, 0)
        const totalProfit = totalSales - totalCost
        const profitMargin = totalSales > 0 ? ((totalProfit / totalSales) * 100).toFixed(2) : '0'
        const totalInvoices = invoices.length
        const averageValue = totalInvoices > 0 ? totalSales / totalInvoices : 0

        // Sales by day
        const salesByDay = invoices.reduce((acc: any[], inv) => {
            if (!inv.issuedAt) return acc
            const day = inv.issuedAt.toISOString().split('T')[0]
            const existing = acc.find(item => item.date === day)
            if (existing) {
                existing.sales += inv.total
                existing.count += 1
            } else {
                acc.push({
                    date: day,
                    sales: inv.total,
                    count: 1,
                })
            }
            return acc
        }, [])

        // Sales by payment method
        const salesByPaymentMethod = invoices.reduce((acc: any, inv) => {
            inv.payments.forEach((p: any) => {
                const method = p.method || 'UNKNOWN'
                acc[method] = (acc[method] || 0) + p.amount
            })
            return acc
        }, {})

        // Top products
        const productStats = invoices.reduce((acc: any[], inv) => {
            inv.items.forEach(item => {
                const existing = acc.find(p => p.id === item.productId)
                const revenue = item.quantity * item.unitPrice
                const cost = (item.product?.cost || 0) * item.quantity
                if (existing) {
                    existing.quantity += item.quantity
                    existing.revenue += revenue
                    existing.cost += cost
                } else {
                    acc.push({
                        id: item.productId,
                        name: item.product?.name || 'Unknown',
                        category: item.product?.category,
                        quantity: item.quantity,
                        revenue,
                        cost,
                    })
                }
            })
            return acc
        }, [])

        const topProducts = productStats
            .map(p => ({
                ...p,
                profit: p.revenue - p.cost,
            }))
            .sort((a, b) => b.revenue - a.revenue)
            .slice(0, 20)

        // Sales by seller
        const salesBySeller = invoices.reduce((acc: any[], inv) => {
            if (!inv.createdBy) return acc
            const existing = acc.find(s => s.sellerId === inv.createdById)
            if (existing) {
                existing.sales += inv.total
                existing.invoiceCount += 1
            } else {
                acc.push({
                    sellerId: inv.createdById,
                    sellerName: inv.createdBy.name || 'Unknown',
                    sales: inv.total,
                    invoiceCount: 1,
                })
            }
            return acc
        }, [])

        const result = {
            summary: {
                totalSales,
                totalCost,
                totalProfit,
                profitMargin: parseFloat(profitMargin),
                totalInvoices,
                averageValue,
                dateRange: { from: fromDate, to: toDate },
            },
            salesByDay,
            salesByPaymentMethod,
            topProducts,
            salesBySeller: salesBySeller.sort((a, b) => b.sales - a.sales),
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
