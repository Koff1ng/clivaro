
import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/api-middleware'
import { getTenantIdFromSession } from '@/lib/tenancy'
import { createJournalEntry, getJournalEntries } from '@/lib/accounting/journal-service'

export async function GET(request: Request) {
    const session = await requirePermission(request as any, 'manage_accounting' as any)
    if (session instanceof NextResponse) return session

    const tenantId = getTenantIdFromSession(session)
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') || undefined
    const start = searchParams.get('start') ? new Date(searchParams.get('start')!) : undefined
    const end = searchParams.get('end') ? new Date(searchParams.get('end')!) : undefined

    const entries = await getJournalEntries(tenantId, { status, start, end })
    return NextResponse.json(entries)
}

export async function POST(request: Request) {
    const session = await requirePermission(request as any, 'manage_accounting' as any)
    if (session instanceof NextResponse) return session

    const tenantId = getTenantIdFromSession(session)
    const userId = session.user.id
    const body = await request.json()

    try {
        const entry = await createJournalEntry(tenantId, userId, body)
        return NextResponse.json(entry)
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 400 })
    }
}
