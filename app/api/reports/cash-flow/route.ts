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

        // Fetch cash movements (Manual IN/OUT)
        const movements = await prisma.cashMovement.findMany({
            where: {
                createdAt: {
                    gte: fromDate,
                    lte: toDate,
                },
            },
            include: {
                createdBy: {
                    select: { name: true }
                }
            },
            orderBy: { createdAt: 'desc' },
        })

        // Fetch all payments (Sales)
        const payments = await prisma.payment.findMany({
            where: {
                createdAt: {
                    gte: fromDate,
                    lte: toDate,
                },
            },
            include: {
                createdBy: {
                    select: { name: true },
                },
                invoice: {
                    select: { number: true }
                }
            }
        })

        // Fetch returns (Inflow reductions)
        const returns = await prisma.return.findMany({
            where: {
                status: 'COMPLETED',
                createdAt: {
                    gte: fromDate,
                    lte: toDate,
                },
            }
        })

        // Agregación
        const dailyMap = new Map()
        let curr = new Date(fromDate)
        while (curr <= toDate) {
            const d = curr.toISOString().split('T')[0]
            dailyMap.set(d, { date: d, in: 0, out: 0, sales: 0, balance: 0 })
            curr.setDate(curr.getDate() + 1)
        }

        let totalIn = 0
        let totalOut = 0
        let totalSales = 0

        const combinedMovements: any[] = []

        // Manual movements
        movements.forEach(m => {
            const day = m.createdAt.toISOString().split('T')[0]
            const stats = dailyMap.get(day)

            if (m.type === 'IN') {
                totalIn += m.amount
                if (stats) stats.in += m.amount
            } else {
                totalOut += m.amount
                if (stats) stats.out += m.amount
            }

            combinedMovements.push({
                id: m.id,
                type: m.type,
                amount: m.amount,
                reason: m.reason,
                createdAt: m.createdAt,
                userName: m.createdBy?.name || 'Sistema',
                source: 'MANUAL'
            })
        })

        // Payments (Sales)
        payments.forEach(p => {
            const day = p.createdAt.toISOString().split('T')[0]
            const stats = dailyMap.get(day)

            totalSales += p.amount
            if (stats) stats.sales += p.amount

            combinedMovements.push({
                id: p.id,
                type: 'IN',
                amount: p.amount,
                reason: `Venta: ${p.invoice?.number || '-'} (${p.method})`,
                createdAt: p.createdAt,
                userName: p.createdBy?.name || 'Sistema',
                source: 'SALE'
            })
        })

        // Returns
        returns.forEach(ret => {
            const day = ret.createdAt.toISOString().split('T')[0]
            const stats = dailyMap.get(day)

            totalOut += ret.total
            if (stats) stats.out += ret.total

            combinedMovements.push({
                id: ret.id,
                type: 'OUT',
                amount: ret.total,
                reason: `Devolución: ${ret.id.slice(-6)}`,
                createdAt: ret.createdAt,
                userName: 'Sistema',
                source: 'RETURN'
            })
        })

        // Final balance calculation
        dailyMap.forEach(stats => {
            stats.balance = (stats.in + stats.sales) - stats.out
        })

        const dailyList = Array.from(dailyMap.values()).sort((a: any, b: any) => a.date.localeCompare(b.date))

        const result = {
            summary: {
                totalIn,
                totalOut,
                totalSales,
                netFlow: (totalIn + totalSales) - totalOut,
                movementCount: combinedMovements.length
            },
            movements: combinedMovements.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
            daily: Array.from(dailyMap.values())
        }

        const duration = Date.now() - startTime
        logger.apiResponse('GET', '/api/reports/cash-flow', 200, duration)

        return NextResponse.json(result)
    } catch (error: any) {
        logger.error('Error fetching cash flow report', error, {
            endpoint: '/api/reports/cash-flow',
        })
        return NextResponse.json(
            { error: error?.message || 'Failed to fetch report' },
            { status: 500 }
        )
    }
}
