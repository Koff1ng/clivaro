
import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/api-middleware'
import { PERMISSIONS } from '@/lib/permissions'
import { getTenantIdFromSession } from '@/lib/tenancy'
import { getUserIdFromSession } from '@/lib/auth'
import { closePeriod, reopenPeriod, getPeriods } from '@/lib/accounting/period-service'

export async function GET(request: Request) {
    const session = await requirePermission(request as any, PERMISSIONS.MANAGE_ACCOUNTING)
    if (session instanceof NextResponse) return session

    const tenantId = getTenantIdFromSession(session)

    const periods = await getPeriods(tenantId)

    return NextResponse.json(periods)
}

export async function POST(request: Request) {
    const session = await requirePermission(request as any, PERMISSIONS.MANAGE_ACCOUNTING)
    if (session instanceof NextResponse) return session

    const tenantId = getTenantIdFromSession(session)
    const userId = getUserIdFromSession(session)

    const body = await request.json()
    const { year, month, action } = body

    if (!year || !month || !action) {
        return NextResponse.json(
            { error: 'Year, month, and action are required' },
            { status: 400 }
        )
    }

    try {
        if (action === 'close') {
            const result = await closePeriod(tenantId, year, month, userId)
            return NextResponse.json(result)
        } else if (action === 'reopen') {
            const result = await reopenPeriod(tenantId, year, month, userId)
            return NextResponse.json(result)
        } else {
            return NextResponse.json(
                { error: 'Invalid action. Use "close" or "reopen"' },
                { status: 400 }
            )
        }
    } catch (error: any) {
        return NextResponse.json(
            { error: error.message },
            { status: 400 }
        )
    }
}
