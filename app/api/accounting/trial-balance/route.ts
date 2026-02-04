
import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/api-middleware'
import { PERMISSIONS } from '@/lib/permissions'
import { getTenantIdFromSession } from '@/lib/tenancy'
import { getTrialBalance } from '@/lib/accounting/ledger-service'

export async function GET(request: Request) {
    const session = await requirePermission(request as any, PERMISSIONS.MANAGE_ACCOUNTING)
    if (session instanceof NextResponse) return session

    const tenantId = getTenantIdFromSession(session)
    const { searchParams } = new URL(request.url)

    const dateParam = searchParams.get('date')
    const asOfDate = dateParam ? new Date(dateParam) : undefined

    const trialBalance = await getTrialBalance(tenantId, asOfDate)

    return NextResponse.json(trialBalance)
}
