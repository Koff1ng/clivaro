import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/api-middleware'
import { PERMISSIONS } from '@/lib/permissions'
import { getTenantIdFromSession, withTenantTx } from '@/lib/tenancy'
import { createJournalEntry } from '@/lib/accounting/journal-service'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
    const session = await requirePermission(request as any, PERMISSIONS.MANAGE_ACCOUNTING)
    if (session instanceof NextResponse) return session

    const tenantId = getTenantIdFromSession(session)
    const userId = (session.user as any).id as string
    const body = await request.json()
    const { type, period, year, amount: userAmount } = body

    try {
        const entry = await withTenantTx(tenantId, async (prisma) => {
            const accounts = await prisma.accountingAccount.findMany({
                where: { tenantId }
            })

            if (accounts.length === 0) {
                throw new Error('No hay cuentas contables configuradas. Inicialice el PUC primero.')
            }

            let description = ''
            let lines: any[] = []

            if (type === 'depreciation') {
                description = `Depreciación Mensual Activos Fijos - Periodo ${period}`

                const depAmount = Number(userAmount)
                if (!depAmount || depAmount <= 0) {
                    throw new Error('Debe ingresar un monto válido de depreciación.')
                }

                let expenseAcc = accounts.find(a => a.code.startsWith('5160') || a.code.startsWith('5260'))
                    || accounts.find(a => a.code.startsWith('51') || a.type === 'EXPENSE')
                let accumAcc = accounts.find(a => a.code.startsWith('1592') || a.code.startsWith('159'))
                    || accounts.find(a => a.type === 'ASSET' && a.code.startsWith('15'))

                if (!expenseAcc) expenseAcc = accounts.find(a => a.type === 'EXPENSE')!
                if (!accumAcc) accumAcc = accounts.find(a => a.type === 'ASSET')!

                if (!expenseAcc || !accumAcc) {
                    throw new Error('No se encontraron cuentas de gasto o activo para procesar la depreciación.')
                }

                lines = [
                    { accountId: expenseAcc.id, description: 'Gasto por Depreciación', debit: depAmount, credit: 0 },
                    { accountId: accumAcc.id, description: 'Depreciación Acumulada', debit: 0, credit: depAmount }
                ]
            } else if (type === 'closing') {
                description = `Cierre de Ejercicio Contable - Año ${year}`

                // Query REAL balances from the ledger for revenue/expense accounts
                const yearStart = new Date(Number(year), 0, 1)
                const yearEnd = new Date(Number(year), 11, 31, 23, 59, 59)

                // Accounts class 4 (income) — nature Credit → debit to close
                const revenueAccounts = accounts.filter(a => a.code.startsWith('4'))
                // Accounts class 5,6,7 (expenses/costs) — nature Debit → credit to close
                const expenseAccounts = accounts.filter(a =>
                    a.code.startsWith('5') || a.code.startsWith('6') || a.code.startsWith('7')
                )

                // Find equity result account (3605 Resultado del Ejercicio)
                let equityAcc = accounts.find(a => a.code.startsWith('3605'))
                    || accounts.find(a => a.code.startsWith('36'))
                    || accounts.find(a => a.type === 'EQUITY')

                if (!equityAcc) {
                    throw new Error('No se encontró la cuenta de Resultado del Ejercicio (3605). Créela primero.')
                }

                // Calculate real balances
                let totalRevenue = 0
                let totalExpenses = 0
                const closingLines: any[] = []

                // Close each revenue account (Debit to zero them out)
                for (const acc of revenueAccounts) {
                    const result = await prisma.journalEntryLine.aggregate({
                        where: {
                            accountId: acc.id,
                            journalEntry: {
                                tenantId,
                                date: { gte: yearStart, lte: yearEnd },
                                status: 'APPROVED'
                            }
                        },
                        _sum: { debit: true, credit: true }
                    })
                    const balance = (result._sum.credit || 0) - (result._sum.debit || 0)
                    if (balance > 0) {
                        totalRevenue += balance
                        closingLines.push({
                            accountId: acc.id,
                            description: `Cancelación ${acc.code} ${acc.name}`,
                            debit: balance,
                            credit: 0
                        })
                    }
                }

                // Close each expense account (Credit to zero them out)
                for (const acc of expenseAccounts) {
                    const result = await prisma.journalEntryLine.aggregate({
                        where: {
                            accountId: acc.id,
                            journalEntry: {
                                tenantId,
                                date: { gte: yearStart, lte: yearEnd },
                                status: 'APPROVED'
                            }
                        },
                        _sum: { debit: true, credit: true }
                    })
                    const balance = (result._sum.debit || 0) - (result._sum.credit || 0)
                    if (balance > 0) {
                        totalExpenses += balance
                        closingLines.push({
                            accountId: acc.id,
                            description: `Cancelación ${acc.code} ${acc.name}`,
                            debit: 0,
                            credit: balance
                        })
                    }
                }

                if (closingLines.length === 0) {
                    throw new Error(`No se encontraron movimientos aprobados en el año ${year} para cerrar.`)
                }

                // Net result → Equity
                const netResult = totalRevenue - totalExpenses
                if (netResult >= 0) {
                    closingLines.push({
                        accountId: equityAcc.id,
                        description: `Utilidad del Ejercicio ${year}`,
                        debit: 0,
                        credit: netResult
                    })
                } else {
                    closingLines.push({
                        accountId: equityAcc.id,
                        description: `Pérdida del Ejercicio ${year}`,
                        debit: Math.abs(netResult),
                        credit: 0
                    })
                }

                lines = closingLines

            } else if (type === 'deferred') {
                description = `Amortización de Diferidos - Periodo ${period}`

                const defAmount = Number(userAmount)
                if (!defAmount || defAmount <= 0) {
                    throw new Error('Debe ingresar un monto válido de amortización.')
                }

                let expenseAcc = accounts.find(a => a.code.startsWith('51') || a.type === 'EXPENSE')
                let deferredAcc = accounts.find(a => a.code.startsWith('17') || a.code.startsWith('27'))
                    || accounts.find(a => a.type === 'LIABILITY')

                if (!expenseAcc) expenseAcc = accounts.find(a => a.type === 'EXPENSE')!
                if (!deferredAcc) deferredAcc = accounts.find(a => a.type === 'ASSET' || a.type === 'LIABILITY')!

                if (!expenseAcc || !deferredAcc) {
                    throw new Error('No se encontraron cuentas de gasto o diferidos para procesar la amortización.')
                }

                lines = [
                    { accountId: expenseAcc.id, description: 'Gasto por Amortización', debit: defAmount, credit: 0 },
                    { accountId: deferredAcc.id, description: 'Cruce Diferido', debit: 0, credit: defAmount }
                ]
            } else {
                throw new Error('Tipo de complemento no válido')
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
