
import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/api-middleware'
import { getTenantIdFromSession } from '@/lib/tenancy'
import { getJournalLines } from '@/lib/accounting/journal-service'

export async function GET(request: Request) {
    const session = await requirePermission(request as any, 'manage_accounting' as any)
    if (session instanceof NextResponse) return session

    const tenantId = getTenantIdFromSession(session)
    const { searchParams } = new URL(request.url)

    const start = searchParams.get('start') ? new Date(searchParams.get('start')!) : undefined
    const end = searchParams.get('end') ? new Date(searchParams.get('end')!) : undefined

    try {
        const lines = await getJournalLines(tenantId, { start, end })
        return NextResponse.json(lines)
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 })
    }
}
