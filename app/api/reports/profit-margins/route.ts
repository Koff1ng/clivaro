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

        // Fetch invoices with details for cost calculation
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
            },
        })

        // Agregación de datos
        const categoryStats: any = {}
        const dailyStats: any = {}
        let totalRevenue = 0
        let totalCost = 0

        invoices.forEach(inv => {
            if (!inv.issuedAt) return
            const day = inv.issuedAt.toISOString().split('T')[0]

            if (!dailyStats[day]) {
                dailyStats[day] = { date: day, revenue: 0, cost: 0, profit: 0 }
            }

            inv.items.forEach(item => {
                const revenue = item.quantity * item.unitPrice
                const cost = (item.product?.cost || 0) * item.quantity
                const profit = revenue - cost
                const category = item.product?.category || 'Sin categoría'

                // Global
                totalRevenue += revenue
                totalCost += cost

                // Daily
                dailyStats[day].revenue += revenue
                dailyStats[day].cost += cost
                dailyStats[day].profit += profit

                // Category
                if (!categoryStats[category]) {
                    categoryStats[category] = { name: category, revenue: 0, cost: 0, profit: 0 }
                }
                categoryStats[category].revenue += revenue
                categoryStats[category].cost += cost
                categoryStats[category].profit += profit
            })
        })

        const categoryList = Object.values(categoryStats).map((c: any) => ({
            ...c,
            margin: c.revenue > 0 ? (c.profit / c.revenue) * 100 : 0
        })).sort((a: any, b: any) => b.profit - a.profit)

        const dailyList = Object.values(dailyStats).sort((a: any, b: any) => a.date.localeCompare(b.date))

        const result = {
            summary: {
                totalRevenue,
                totalCost,
                totalProfit: totalRevenue - totalCost,
                overallMargin: totalRevenue > 0 ? ((totalRevenue - totalCost) / totalRevenue) * 100 : 0
            },
            byCategory: categoryList,
            byDay: dailyList
        }

        const duration = Date.now() - startTime
        logger.apiResponse('GET', '/api/reports/profit-margins', 200, duration)

        return NextResponse.json(result)
    } catch (error: any) {
        logger.error('Error fetching profit margins report', error, {
            endpoint: '/api/reports/profit-margins',
        })
        return NextResponse.json(
            { error: error?.message || 'Failed to fetch report' },
            { status: 500 }
        )
    }
}
