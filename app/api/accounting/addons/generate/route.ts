import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/api-middleware'
import { getTenantIdFromSession, withTenantTx } from '@/lib/tenancy'
import { createJournalEntry } from '@/lib/accounting/journal-service'

export async function POST(request: Request) {
    const session = await requirePermission(request as any, 'manage_accounting' as any)
    if (session instanceof NextResponse) return session

    const tenantId = getTenantIdFromSession(session)
    const userId = (session.user as any).id
    const body = await request.json()
    const { type, period, year } = body

    try {
        const entry = await withTenantTx(tenantId, async (prisma) => {
            // Find general accounts to use for mock generation
            const accounts = await prisma.accountingAccount.findMany({
                where: { tenantId }
            })

            if (accounts.length === 0) {
                throw new Error('No accounting accounts found in the system for this tenant.')
            }

            let description = ''
            let lines: any[] = []

            if (type === 'depreciation') {
                description = `Depreciación Mensual Activos Fijos - Periodo ${period}`

                // Try to find an expense account (class 5) and an asset/accumulated dep (class 1)
                let expenseAcc = accounts.find(a => a.code.startsWith('51') || a.type === 'EXPENSE')
                let assetAcc = accounts.find(a => a.code.startsWith('159') || a.type === 'ASSET')

                // Fallbacks
                if (!expenseAcc) expenseAcc = accounts[0]
                if (!assetAcc) assetAcc = accounts[1] || accounts[0]

                const amount = 1500000 // Mock amount
                lines = [
                    { accountId: expenseAcc.id, description: 'Gasto por Depreciación', debit: amount, credit: 0 },
                    { accountId: assetAcc.id, description: 'Depreciación Acumulada', debit: 0, credit: amount }
                ]
            } else if (type === 'closing') {
                description = `Cierre de Ejercicio Contable - Año ${year}`

                let revenueAcc = accounts.find(a => a.code.startsWith('4') || a.type === 'REVENUE')
                let expenseAcc = accounts.find(a => a.code.startsWith('5') || a.type === 'EXPENSE')
                let equityAcc = accounts.find(a => a.code.startsWith('3') || a.type === 'EQUITY')

                if (!revenueAcc) revenueAcc = accounts[0]
                if (!expenseAcc) expenseAcc = accounts[1] || accounts[0]
                if (!equityAcc) equityAcc = accounts[2] || accounts[0]

                const revAmount = 50000000
                const expAmount = 35000000
                const netAmount = revAmount - expAmount

                lines = [
                    { accountId: revenueAcc.id, description: 'Cancelación de Ingresos', debit: revAmount, credit: 0 },
                    { accountId: expenseAcc.id, description: 'Cancelación de Gastos', debit: 0, credit: expAmount },
                    { accountId: equityAcc.id, description: 'Resultado del Ejercicio', debit: 0, credit: netAmount }
                ]
            } else if (type === 'deferred') {
                description = `Amortización de Diferidos - Periodo ${period}`

                let expenseAcc = accounts.find(a => a.code.startsWith('51') || a.type === 'EXPENSE')
                let deferredAcc = accounts.find(a => a.code.startsWith('17') || a.code.startsWith('27') || a.type === 'LIABILITY')

                if (!expenseAcc) expenseAcc = accounts[0]
                if (!deferredAcc) deferredAcc = accounts[1] || accounts[0]

                const amount = 850000
                lines = [
                    { accountId: expenseAcc.id, description: 'Gasto por Amortización', debit: amount, credit: 0 },
                    { accountId: deferredAcc.id, description: 'Cruce Diferido', debit: 0, credit: amount }
                ]
            } else {
                throw new Error('Invalid addon type')
            }

            // Determine date
            let date = new Date()
            if (period) {
                const [y, m] = period.split('-').map(Number)
                date = new Date(y, m, 0) // Last day of period
            } else if (year) {
                date = new Date(Number(year), 11, 31) // Dec 31
            }

            return await createJournalEntry(tenantId, userId, {
                date,
                type: 'JOURNAL',
                description,
                status: 'DRAFT',
                reference: `AUTO-${type.toUpperCase()}`,
                lines
            }, prisma)
        })

        return NextResponse.json(entry)
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 400 })
    }
}
