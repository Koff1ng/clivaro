
import { prisma } from '@/lib/db'

export type LedgerFilters = {
    accountId?: string
    startDate?: Date
    endDate?: Date
}

export type AccountBalance = {
    accountId: string
    accountCode: string
    accountName: string
    accountType: string
    initialBalance: number
    totalDebits: number
    totalCredits: number
    finalBalance: number
    movements: Array<{
        date: Date
        entryNumber: string
        description: string
        debit: number
        credit: number
        balance: number
    }>
}

export type TrialBalanceAccount = {
    code: string
    name: string
    type: string
    debit: number
    credit: number
    debitBalance: number
    creditBalance: number
}

/**
 * Get General Ledger (Libro Mayor) for specific account(s)
 */
export async function getGeneralLedger(
    tenantId: string,
    filters: LedgerFilters
): Promise<AccountBalance[]> {
    const { accountId, startDate, endDate } = filters

    // Build account filter
    const accountWhere: any = { tenantId, active: true }
    if (accountId) {
        accountWhere.id = accountId
    }

    const accounts = await prisma.accountingAccount.findMany({
        where: accountWhere,
        orderBy: { code: 'asc' }
    })

    const results: AccountBalance[] = []

    for (const account of accounts) {
        // Calculate initial balance (movements before startDate)
        let initialBalance = 0
        if (startDate) {
            const priorLines = await prisma.journalEntryLine.findMany({
                where: {
                    accountId: account.id,
                    journalEntry: {
                        tenantId,
                        date: { lt: startDate },
                        status: 'APPROVED'
                    }
                }
            })

            priorLines.forEach(line => {
                initialBalance += line.debit - line.credit
            })
        }

        // Get movements in period
        const lineWhere: any = {
            accountId: account.id,
            journalEntry: {
                tenantId,
                status: 'APPROVED'
            }
        }

        if (startDate || endDate) {
            lineWhere.journalEntry.date = {}
            if (startDate) lineWhere.journalEntry.date.gte = startDate
            if (endDate) lineWhere.journalEntry.date.lte = endDate
        }

        const lines = await prisma.journalEntryLine.findMany({
            where: lineWhere,
            include: {
                journalEntry: {
                    select: {
                        number: true,
                        date: true,
                        description: true
                    }
                }
            },
            orderBy: {
                journalEntry: { date: 'asc' }
            }
        })

        // Calculate running balance and totals
        let runningBalance = initialBalance
        let totalDebits = 0
        let totalCredits = 0

        const movements = lines.map(line => {
            totalDebits += line.debit
            totalCredits += line.credit
            runningBalance += line.debit - line.credit

            return {
                date: line.journalEntry.date,
                entryNumber: line.journalEntry.number,
                description: line.description || line.journalEntry.description,
                debit: line.debit,
                credit: line.credit,
                balance: runningBalance
            }
        })

        // Only include accounts with movements or non-zero initial balance
        if (movements.length > 0 || initialBalance !== 0) {
            results.push({
                accountId: account.id,
                accountCode: account.code,
                accountName: account.name,
                accountType: account.type,
                initialBalance,
                totalDebits,
                totalCredits,
                finalBalance: runningBalance,
                movements
            })
        }
    }

    return results
}

/**
 * Get Trial Balance (Balance de Prueba) at specific date
 */
export async function getTrialBalance(
    tenantId: string,
    asOfDate?: Date
): Promise<{
    accounts: TrialBalanceAccount[]
    totals: {
        totalDebits: number
        totalCredits: number
        totalDebitBalance: number
        totalCreditBalance: number
    }
}> {
    const date = asOfDate || new Date()

    // Get all accounts with their movements
    const accounts = await prisma.accountingAccount.findMany({
        where: { tenantId, active: true },
        orderBy: { code: 'asc' }
    })

    const results: TrialBalanceAccount[] = []
    let totalDebits = 0
    let totalCredits = 0
    let totalDebitBalance = 0
    let totalCreditBalance = 0

    for (const account of accounts) {
        // Get all approved movements up to date
        const lines = await prisma.journalEntryLine.findMany({
            where: {
                accountId: account.id,
                journalEntry: {
                    tenantId,
                    date: { lte: date },
                    status: 'APPROVED'
                }
            }
        })

        let debit = 0
        let credit = 0

        lines.forEach(line => {
            debit += line.debit
            credit += line.credit
        })

        const balance = debit - credit
        const debitBalance = balance > 0 ? balance : 0
        const creditBalance = balance < 0 ? Math.abs(balance) : 0

        // Only include accounts with movements
        if (debit > 0 || credit > 0) {
            results.push({
                code: account.code,
                name: account.name,
                type: account.type,
                debit,
                credit,
                debitBalance,
                creditBalance
            })

            totalDebits += debit
            totalCredits += credit
            totalDebitBalance += debitBalance
            totalCreditBalance += creditBalance
        }
    }

    return {
        accounts: results,
        totals: {
            totalDebits,
            totalCredits,
            totalDebitBalance,
            totalCreditBalance
        }
    }
}

/**
 * Get balance for specific account
 */
export async function getAccountBalance(
    tenantId: string,
    accountId: string,
    startDate?: Date,
    endDate?: Date
): Promise<number> {
    const where: any = {
        accountId,
        journalEntry: {
            tenantId,
            status: 'APPROVED'
        }
    }

    if (startDate || endDate) {
        where.journalEntry.date = {}
        if (startDate) where.journalEntry.date.gte = startDate
        if (endDate) where.journalEntry.date.lte = endDate
    }

    const lines = await prisma.journalEntryLine.findMany({ where })

    let balance = 0
    lines.forEach(line => {
        balance += line.debit - line.credit
    })

    return balance
}
