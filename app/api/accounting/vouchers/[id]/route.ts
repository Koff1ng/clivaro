
import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/api-middleware'
import { getTenantIdFromSession } from '@/lib/tenancy'
import { getJournalEntry, approveJournalEntry } from '@/lib/accounting/journal-service'

export async function GET(
    request: Request,
    { params }: { params: { id: string } }
) {
    const session = await requirePermission(request as any, 'manage_accounting' as any)
    if (session instanceof NextResponse) return session

    const tenantId = getTenantIdFromSession(session)
    const entry = await getJournalEntry(tenantId, params.id)

    if (!entry) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(entry)
}

export async function PATCH(
    request: Request,
    { params }: { params: { id: string } }
) {
    const session = await requirePermission(request as any, 'manage_accounting' as any)
    if (session instanceof NextResponse) return session

    const tenantId = getTenantIdFromSession(session)
    const userId = session.user.id
    const body = await request.json()

    try {
        if (body.action === 'approve') {
            const entry = await approveJournalEntry(tenantId, params.id, userId)
            return NextResponse.json(entry)
        }
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 400 })
    }
}
