
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
        // Verify account ownership
        const account = await prisma.accountingAccount.findFirst({
            where: { id: accountId, tenantId }
        })
        if (!account) return NextResponse.json({ error: 'Account not found' }, { status: 404 })

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

        // Calculate Ledger Balance (Accumulated up to 'end')
        const balanceResult = await prisma.journalEntryLine.aggregate({
            where: {
                accountId,
                journalEntry: {
                    tenantId,
                    date: { lte: end },
                    status: 'APPROVED'
                }
            },
            _sum: {
                debit: true,
                credit: true
            }
        })

        const ledgerBalance = (balanceResult._sum.debit || 0) - (balanceResult._sum.credit || 0)

        return NextResponse.json({
            reconciliation,
            bookEntries,
            ledgerBalance
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
        // Verify account ownership
        const account = await prisma.accountingAccount.findFirst({
            where: { id: accountId, tenantId }
        })
        if (!account) return NextResponse.json({ error: 'Account not found' }, { status: 404 })

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
        if (action === 'match' || action === 'unmatch') {
            const { bankEntryId } = data

            // SECURITY: Verify ownership and status
            const entry = await prisma.bankStatementEntry.findFirst({
                where: { id: bankEntryId, reconciliation: { tenantId } },
                include: { reconciliation: true }
            })

            if (!entry) return NextResponse.json({ error: 'Entry not found' }, { status: 404 })
            if (entry.reconciliation.status === 'CLOSED') {
                return NextResponse.json({ error: 'Reconciliation is closed' }, { status: 400 })
            }

            if (action === 'match') {
                const { journalLineId } = data
                // Verify journal line ownership
                const line = await prisma.journalEntryLine.findFirst({
                    where: { id: journalLineId, journalEntry: { tenantId } }
                })
                if (!line) return NextResponse.json({ error: 'Journal line not found' }, { status: 404 })

                await prisma.bankStatementEntry.update({
                    where: { id: bankEntryId },
                    data: { journalEntryLineId: journalLineId, status: 'MATCHED' }
                })
            } else {
                await prisma.bankStatementEntry.update({
                    where: { id: bankEntryId },
                    data: { journalEntryLineId: null, status: 'PENDING' }
                })
            }
            return NextResponse.json({ success: true })
        }

        if (action === 'update_entry') {
            const { entryId, description, amount } = data

            // SECURITY: Verify ownership and status
            const entry = await prisma.bankStatementEntry.findFirst({
                where: { id: entryId, reconciliation: { tenantId } },
                include: { reconciliation: true }
            })

            if (!entry) return NextResponse.json({ error: 'Entry not found' }, { status: 404 })
            if (entry.reconciliation.status === 'CLOSED') {
                return NextResponse.json({ error: 'Reconciliation is closed' }, { status: 400 })
            }

            await prisma.bankStatementEntry.update({
                where: { id: entryId },
                data: {
                    description,
                    amount,
                    debit: amount > 0 ? amount : 0,
                    credit: amount < 0 ? Math.abs(amount) : 0
                }
            })
            return NextResponse.json({ success: true })
        }

        if (action === 'close') {
            const { id, balanceBank, balanceBooks } = data
            // Verify ownership
            const recon = await prisma.bankReconciliation.findFirst({
                where: { id, tenantId }
            })
            if (!recon) return NextResponse.json({ error: 'Reconciliation not found' }, { status: 404 })

            await prisma.bankReconciliation.update({
                where: { id },
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
