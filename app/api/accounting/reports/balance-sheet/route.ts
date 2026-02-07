
import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/api-middleware'
import { PERMISSIONS } from '@/lib/permissions'
import { getTenantIdFromSession } from '@/lib/tenancy'
import { getBalanceSheet } from '@/lib/accounting/report-service'

export async function GET(request: Request) {
    const session = await requirePermission(request as any, PERMISSIONS.MANAGE_ACCOUNTING)
    if (session instanceof NextResponse) return session

    const tenantId = getTenantIdFromSession(session)
    const { searchParams } = new URL(request.url)
    const asOfDate = searchParams.get('date') ? new Date(searchParams.get('date')!) : new Date()

    const data = await getBalanceSheet(tenantId, asOfDate)
    return NextResponse.json(data)
}
