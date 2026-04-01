import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/api-middleware'
import { withTenantRead, withTenantTx } from '@/lib/tenancy'
import { PERMISSIONS } from '@/lib/permissions'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
    const session = await requirePermission(request as any, PERMISSIONS.MANAGE_ACCOUNTING)
    if (session instanceof NextResponse) return session

    const tenantId = (session.user as any).tenantId

    try {
        const { searchParams } = new URL(request.url)
        const status = searchParams.get('status') || undefined
        const start = searchParams.get('start') ? new Date(searchParams.get('start')!) : undefined
        const end = searchParams.get('end') ? new Date(searchParams.get('end')!) : undefined

        const entries = await withTenantRead(tenantId, async (prisma) => {
            const where: any = { tenantId }
            if (status && status !== 'ALL') where.status = status
            if (start && end) {
                where.date = { gte: start, lte: end }
            }

            return await prisma.journalEntry.findMany({
                where,
                orderBy: { date: 'desc' },
                include: { createdBy: { select: { name: true } } }
            })
        })

        return NextResponse.json(entries)
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 })
    }
}

export async function POST(request: Request) {
    const session = await requirePermission(request as any, PERMISSIONS.MANAGE_ACCOUNTING)
    if (session instanceof NextResponse) return session

    const tenantId = (session.user as any).tenantId
    const userId = (session.user as any).id
    const body = await request.json()

    try {
        const entry = await withTenantTx(tenantId, async (prisma) => {
            // Import createJournalEntry and pass tenant prisma
            const { createJournalEntry } = await import('@/lib/accounting/journal-service')
            return await createJournalEntry(tenantId, userId, body, prisma)
        })
        return NextResponse.json(entry)
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 400 })
    }
}
