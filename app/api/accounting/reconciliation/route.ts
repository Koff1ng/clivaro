
import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/api-middleware'
import { PERMISSIONS } from '@/lib/permissions'
import { getTenantIdFromSession } from '@/lib/tenancy'
import { prisma } from '@/lib/db'

export async function GET(request: Request) {
    const session = await requirePermission(request as any, PERMISSIONS.MANAGE_ACCOUNTING)
    if (session instanceof NextResponse) return session

    const tenantId = getTenantIdFromSession(session)
    const { searchParams } = new URL(request.url)
    const accountId = searchParams.get('accountId')
    const period = searchParams.get('period') // YYYY-MM

    if (!accountId || !period) {
        return NextResponse.json({ error: 'Missing accountId or period' }, { status: 400 })
    }

    try {
        const reconciliation = await prisma.bankReconciliation.findUnique({
            where: {
                tenantId_accountId_period: { tenantId, accountId, period }
            },
            include: {
                entries: {
                    orderBy: { date: 'asc' },
                    include: {
                        journalEntryLine: {
                            include: {
                                journalEntry: true
                            }
                        }
                    }
                }
            } as any
        })

        // Fetch book entries for this account and period (Approved and not yet matched)
        const [y, m] = period.split('-').map(Number)
        const start = new Date(y, m - 1, 1)
        const end = new Date(y, m, 0, 23, 59, 59)

        const bookEntries = await prisma.journalEntryLine.findMany({
            where: {
                accountId,
                journalEntry: {
                    tenantId,
                    date: { gte: start, lte: end },
                    status: 'APPROVED'
                },
                bankStatementEntry: null
            },
            include: {
                journalEntry: true,
                account: true
            }
        })

        return NextResponse.json({
            reconciliation,
            bookEntries
        })
    } catch (e: any) {
        console.error(e)
        return NextResponse.json({ error: e.message }, { status: 500 })
    }
}

export async function POST(request: Request) {
    const session = await requirePermission(request as any, PERMISSIONS.MANAGE_ACCOUNTING)
    if (session instanceof NextResponse) return session

    const tenantId = getTenantIdFromSession(session)
    const formData = await request.formData()
    const accountId = formData.get('accountId') as string
    const period = formData.get('period') as string
    const file = formData.get('file') as File

    if (!accountId || !period || !file) {
        return NextResponse.json({ error: 'Missing data' }, { status: 400 })
    }

    try {
        let reconciliation = await prisma.bankReconciliation.findUnique({
            where: { tenantId_accountId_period: { tenantId, accountId, period } }
        })

        if (!reconciliation) {
            reconciliation = await prisma.bankReconciliation.create({
                data: { tenantId, accountId, period }
            })
        }

        if (reconciliation.status === 'OPEN') {
            await prisma.bankStatementEntry.deleteMany({ where: { reconciliationId: reconciliation.id } })

            // Mock dynamic entries based on period
            const [year, month] = period.split('-').map(Number)
            const mockEntries = [
                { date: new Date(year, month - 1, 5), description: 'PAGO PROVEEDOR 123', amount: -540000, reference: 'TRF-001' },
                { date: new Date(year, month - 1, 10), description: 'TRANSFERENCIA RECIBIDA', amount: 1250000, reference: 'TRF-002' },
                { date: new Date(year, month - 1, 15), description: 'COMISION BANCARIA', amount: -18500, reference: 'CHG-99' },
                { date: new Date(year, month - 1, 20), description: 'ABONO CLIENTE XYZ', amount: 890000, reference: 'DEP-044' },
            ]

            await prisma.bankStatementEntry.createMany({
                data: mockEntries.map(e => ({
                    reconciliationId: reconciliation!.id,
                    date: e.date,
                    description: e.description,
                    reference: e.reference,
                    debit: e.amount > 0 ? e.amount : 0,
                    credit: e.amount < 0 ? Math.abs(e.amount) : 0,
                    amount: e.amount,
                    status: 'PENDING'
                }))
            })
        }

        return NextResponse.json({ success: true, reconciliationId: reconciliation.id })
    } catch (e: any) {
        console.error(e)
        return NextResponse.json({ error: e.message }, { status: 500 })
    }
}

export async function PATCH(request: Request) {
    const session = await requirePermission(request as any, PERMISSIONS.MANAGE_ACCOUNTING)
    if (session instanceof NextResponse) return session

    const tenantId = getTenantIdFromSession(session)
    const body = await request.json()
    const { action, ...data } = body

    try {
        if (action === 'match') {
            const { bankEntryId, journalLineId } = data
            await prisma.bankStatementEntry.update({
                where: { id: bankEntryId },
                data: { journalEntryLineId: journalLineId, status: 'MATCHED' }
            })
            return NextResponse.json({ success: true })
        }

        if (action === 'unmatch') {
            const { bankEntryId } = data
            await prisma.bankStatementEntry.update({
                where: { id: bankEntryId },
                data: { journalEntryLineId: null, status: 'PENDING' }
            })
            return NextResponse.json({ success: true })
        }

        if (action === 'close') {
            const { id, balanceBank, balanceBooks } = data
            await prisma.bankReconciliation.update({
                where: { id, tenantId },
                data: {
                    status: 'CLOSED',
                    balanceBank,
                    balanceBooks,
                    difference: balanceBank - balanceBooks
                }
            })
            return NextResponse.json({ success: true })
        }

        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    } catch (e: any) {
        console.error(e)
        return NextResponse.json({ error: e.message }, { status: 500 })
    }
}
