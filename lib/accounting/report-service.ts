
import { prisma } from '@/lib/db'

export type ReportFilters = {
    startDate?: Date
    endDate?: Date
    accountId?: string
    thirdPartyId?: string
}

/**
 * Get Balance Sheet data
 */
export async function getBalanceSheet(tenantId: string, asOfDate: Date) {
    const accounts = await prisma.accountingAccount.findMany({
        where: {
            tenantId,
            active: true,
            code: { startsWith: '1' } // Assets
        },
        orderBy: { code: 'asc' }
    })

    const liabilities = await prisma.accountingAccount.findMany({
        where: {
            tenantId,
            active: true,
            code: { startsWith: '2' } // Liabilities
        },
        orderBy: { code: 'asc' }
    })

    const equity = await prisma.accountingAccount.findMany({
        where: {
            tenantId,
            active: true,
            code: { startsWith: '3' } // Equity
        },
        orderBy: { code: 'asc' }
    })

    const allAccounts = [...accounts, ...liabilities, ...equity]
    const reportData = []

    for (const acc of allAccounts) {
        const balance = await getAccountBalanceAtDate(tenantId, acc.id, asOfDate)
        if (balance !== 0 || acc.code.length <= 4) { // Include parents or non-zero
            reportData.push({
                id: acc.id,
                code: acc.code,
                name: acc.name,
                balance
            })
        }
    }

    return reportData
}

/**
 * Get Profit and Loss data
 */
export async function getProfitAndLoss(tenantId: string, startDate: Date, endDate: Date) {
    const accounts = await prisma.accountingAccount.findMany({
        where: {
            tenantId,
            active: true,
            OR: [
                { code: { startsWith: '4' } }, // Revenue
                { code: { startsWith: '5' } }, // Expenses
                { code: { startsWith: '6' } }, // Costs
                { code: { startsWith: '7' } }  // Prod Costs
            ]
        },
        orderBy: { code: 'asc' }
    })

    const reportData = []

    for (const acc of accounts) {
        const movement = await getAccountMovementInPeriod(tenantId, acc.id, startDate, endDate)
        if (movement !== 0 || acc.code.length <= 4) {
            reportData.push({
                id: acc.id,
                code: acc.code,
                name: acc.name,
                movement
            })
        }
    }

    return reportData
}

/**
 * Get Auxiliary by Third Party
 */
export async function getAuxiliaryByThirdParty(tenantId: string, thirdPartyId: string, startDate: Date, endDate: Date) {
    const lines = await prisma.journalEntryLine.findMany({
        where: {
            journalEntry: {
                tenantId,
                date: { gte: startDate, lte: endDate },
                status: 'APPROVED'
            },
            OR: [
                { customerId: thirdPartyId },
                { supplierId: thirdPartyId },
                { accountingThirdPartyId: thirdPartyId }
            ]
        },
        include: {
            account: { select: { code: true, name: true } },
            journalEntry: { select: { number: true, date: true, type: true } }
        },
        orderBy: { journalEntry: { date: 'asc' } }
    })

    return lines
}

// Helpers
async function getAccountBalanceAtDate(tenantId: string, accountId: string, date: Date) {
    const result = await prisma.journalEntryLine.aggregate({
        where: {
            accountId,
            journalEntry: {
                tenantId,
                date: { lte: date },
                status: 'APPROVED'
            }
        },
        _sum: {
            debit: true,
            credit: true
        }
    })

    return (result._sum.debit || 0) - (result._sum.credit || 0)
}

async function getAccountMovementInPeriod(tenantId: string, accountId: string, start: Date, end: Date) {
    const result = await prisma.journalEntryLine.aggregate({
        where: {
            accountId,
            journalEntry: {
                tenantId,
                date: { gte: start, lte: end },
                status: 'APPROVED'
            }
        },
        _sum: {
            debit: true,
            credit: true
        }
    })

    return (result._sum.debit || 0) - (result._sum.credit || 0)
}
