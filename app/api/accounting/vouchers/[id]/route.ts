
import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/api-middleware'
import { withTenantRead, withTenantTx } from '@/lib/tenancy'
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

    const tenantId = (session.user as any).tenantId

    const entry = await withTenantRead(tenantId, async (prisma) => {
        return await prisma.journalEntry.findFirst({
            where: { id: entryId, tenantId },
            include: { lines: { include: { account: true } }, createdBy: true }
        })
    })

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

    const tenantId = (session.user as any).tenantId
    const userId = (session.user as any).id as string
    const body = await request.json()

    try {
        const result = await withTenantTx(tenantId, async (prisma) => {
            if (body.action === 'approve') {
                const entry = await prisma.journalEntry.findUnique({
                    where: { id: entryId },
                    include: { lines: true }
                })

                if (!entry || entry.tenantId !== tenantId) throw new Error('Entry not found')
                if (entry.status !== 'DRAFT') throw new Error('Entry is not in DRAFT state')

                const diff = Math.abs(entry.totalDebit - entry.totalCredit)
                if (diff > 0.01) throw new Error(`Entry is not balanced. Diff: ${diff}`)

                return await prisma.journalEntry.update({
                    where: { id: entryId },
                    data: {
                        status: 'APPROVED',
                        approvedById: userId,
                        approvedAt: new Date()
                    },
                    include: {
                        lines: { include: { account: true } },
                        createdBy: true
                    }
                })
            }

            if (body.action === 'annul') {
                const entry = await prisma.journalEntry.findUnique({
                    where: { id: entryId }
                })

                if (!entry || entry.tenantId !== tenantId) throw new Error('Entry not found')
                if (entry.status === 'ANNULLED') throw new Error('Entry is already annulled')

                return await prisma.journalEntry.update({
                    where: { id: entryId },
                    data: { status: 'ANNULLED' }
                })
            }

            throw new Error('Invalid action')
        })

        return NextResponse.json(result)
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 400 })
    }
}
