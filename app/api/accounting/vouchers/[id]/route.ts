
import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/api-middleware'
import { getTenantIdFromSession } from '@/lib/tenancy'
import { getJournalEntry, approveJournalEntry, annulJournalEntry } from '@/lib/accounting/journal-service'
import { PERMISSIONS } from '@/lib/permissions'

export const dynamic = 'force-dynamic'

export async function GET(
    request: Request,
    { params }: { params: { id: string } | Promise<{ id: string }> }
) {
    const resolvedParams = await Promise.resolve(params)
    const entryId = resolvedParams.id

    const session = await requirePermission(request as any, PERMISSIONS.MANAGE_ACCOUNTING)
    if (session instanceof NextResponse) return session

    const tenantId = getTenantIdFromSession(session)
    const entry = await getJournalEntry(tenantId, entryId)

    if (!entry) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(entry)
}

export async function PATCH(
    request: Request,
    { params }: { params: { id: string } | Promise<{ id: string }> }
) {
    const resolvedParams = await Promise.resolve(params)
    const entryId = resolvedParams.id

    const session = await requirePermission(request as any, PERMISSIONS.MANAGE_ACCOUNTING)
    if (session instanceof NextResponse) return session

    const tenantId = getTenantIdFromSession(session)
    const userId = (session.user as any).id as string
    const body = await request.json()

    try {
        if (body.action === 'approve') {
            const entry = await approveJournalEntry(tenantId, entryId, userId)
            return NextResponse.json(entry)
        }
        if (body.action === 'annul') {
            const entry = await annulJournalEntry(tenantId, entryId, userId)
            return NextResponse.json(entry)
        }
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 400 })
    }
}
