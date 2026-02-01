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

        // Fetch cash movements
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

        // Agregación
        const dailyStats: any = {}
        let totalIn = 0
        let totalOut = 0

        movements.forEach(m => {
            const day = m.createdAt.toISOString().split('T')[0]
            if (!dailyStats[day]) {
                dailyStats[day] = { date: day, in: 0, out: 0, balance: 0 }
            }

            if (m.type === 'IN') {
                totalIn += m.amount
                dailyStats[day].in += m.amount
            } else {
                totalOut += m.amount
                dailyStats[day].out += m.amount
            }
            dailyStats[day].balance = dailyStats[day].in - dailyStats[day].out
        })

        const dailyList = Object.values(dailyStats).sort((a: any, b: any) => a.date.localeCompare(b.date))

        const result = {
            summary: {
                totalIn,
                totalOut,
                netFlow: totalIn - totalOut,
                movementCount: movements.length
            },
            movements: movements.map(m => ({
                id: m.id,
                type: m.type,
                amount: m.amount,
                reason: m.reason,
                createdAt: m.createdAt,
                userName: m.createdBy.name
            })),
            daily: dailyList
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
