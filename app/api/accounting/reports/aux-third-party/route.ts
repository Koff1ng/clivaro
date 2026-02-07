
import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/api-middleware'
import { PERMISSIONS } from '@/lib/permissions'
import { getTenantIdFromSession } from '@/lib/tenancy'
import { getAuxiliaryByThirdParty } from '@/lib/accounting/report-service'

export async function GET(request: Request) {
    const session = await requirePermission(request as any, PERMISSIONS.MANAGE_ACCOUNTING)
    if (session instanceof NextResponse) return session

    const tenantId = getTenantIdFromSession(session)
    const { searchParams } = new URL(request.url)

    const thirdPartyId = searchParams.get('thirdPartyId')
    if (!thirdPartyId) return NextResponse.json({ error: 'Missing thirdPartyId' }, { status: 400 })

    const start = searchParams.get('start') ? new Date(searchParams.get('start')!) : new Date(new Date().getFullYear(), 0, 1)
    const end = searchParams.get('end') ? new Date(searchParams.get('end')!) : new Date()

    const data = await getAuxiliaryByThirdParty(tenantId, thirdPartyId, start, end)
    return NextResponse.json(data)
}
