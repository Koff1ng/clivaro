import { prisma } from '@/lib/db'
import { logger } from '../logger'
import { logAction } from './audit-service'
import { validatePeriodNotClosed } from './period-service'

/**
 * Input data required to create a new Journal Entry.
 */
export type JournalEntryInput = {
    /** The transaction date */
    date: Date
    /** Type of entry (e.g., 'SALES', 'PURCHASE', 'PAYROLL') */
    type: string
    /** General description of the entry */
    description: string
    /** Optional reference number (e.g., Invoice #, Receipt #) */
    reference?: string
    /** Initial status of the entry */
    status?: 'DRAFT' | 'APPROVED'
    /** Accounting lines (debits and credits) */
    lines: Array<{
        /** Target account ID */
        accountId: string
        /** Line-specific description (defaults to entry description) */
        description?: string
        /** Debit amount (must be positive or omitted) */
        debit?: number
        /** Credit amount (must be positive or omitted) */
        credit?: number
        /** ID of the third party in the accounting system */
        accountingThirdPartyId?: string
        /** Legacy/Auto ID for Customers */
        thirdPartyId?: string
        /** Legacy/Auto ID for Suppliers */
        supplierId?: string
        /** Display name for the third party */
        thirdPartyName?: string
        /** Tax ID (NIT/RUT) for the third party */
        thirdPartyNit?: string
    }>
}

/**
 * Creates a new journal entry in the system.
 * This function supports atomic transactions by passing a `prismaTx` client.
 * 
 * @param tenantId - The unique ID of the tenant.
 * @param userId - The ID of the user creating the entry.
 * @param data - The entry data (lines, date, etc).
 * @param prismaTx - Optional Prisma transaction client to ensure atomicity.
 * @returns The created journal entry with its lines.
 */
export async function createJournalEntry(tenantId: string, userId: string, data: JournalEntryInput, prismaTx?: any) {
    // Basic validation
    let totalDebit = 0
    let totalCredit = 0

    if (!data.lines || data.lines.length === 0) {
        throw new Error('El comprobante debe tener al menos una línea')
    }

    data.lines.forEach(l => {
        if (!l.accountId) throw new Error('Todas las líneas deben tener una cuenta contable asociada')
        totalDebit += l.debit || 0
        totalCredit += l.credit || 0
    })

    const date = new Date(data.date)
    const period = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`

    // Validate period is not closed
    await validatePeriodNotClosed(tenantId, date)

    const execute = async (tx: any) => {
        // Deep validation of accounts inside the transaction
        const accountIds = [...new Set(data.lines.map(l => l.accountId))]
        const foundAccounts = await tx.accountingAccount.findMany({
            where: { id: { in: accountIds } }
        })

        if (foundAccounts.length !== accountIds.length) {
            const missing = accountIds.filter(id => !foundAccounts.find(a => a.id === id))
            logger.error(`[JOURNAL_ERROR] Missing accounts in schema for tenant ${tenantId}:`, missing)
            throw new Error(`Error de integridad contable: Las cuentas [${missing.join(', ')}] no existen en el Plan de Cuentas de esta empresa.`)
        }

        const count = await tx.journalEntry.count({
            where: { tenantId, period }
        })
        const number = `${period}-${String(count + 1).padStart(4, '0')}`

        try {
            const entry = await tx.journalEntry.create({
                data: {
                    tenantId,
                    number,
                    date,
                    period,
                    type: data.type,
                    description: data.description,
                    reference: data.reference,
                    status: data.status || 'DRAFT',
                    totalDebit,
                    totalCredit,
                    createdById: userId,
                    lines: {
                        create: data.lines.map(l => ({
                            accountId: l.accountId,
                            description: l.description || data.description,
                            debit: l.debit || 0,
                            credit: l.credit || 0,
                            accountingThirdPartyId: l.accountingThirdPartyId,
                            customerId: l.thirdPartyId, // Map to customerId relation
                            supplierId: l.supplierId,
                            thirdPartyId: l.thirdPartyId || l.supplierId || l.accountingThirdPartyId, // Keep legacy field for compatibility
                            thirdPartyName: l.thirdPartyName,
                            thirdPartyNit: l.thirdPartyNit
                        }))
                    }
                },
                include: { lines: true }
            })

            // Log creation
            await logAction(tenantId, 'JOURNAL_ENTRY', entry.id, 'CREATED', userId, {
                number: entry.number,
                description: entry.description
            }, tx)

            return entry
        } catch (err: any) {
            logger.error(`[JOURNAL_CREATE_ERROR] Failed for tenant ${tenantId}:`, err.message)
            if (err.code === 'P2003') {
                logger.error(`[JOURNAL_CREATE_ERROR] Foreign key violation details:`, JSON.stringify(err.meta))
            }
            throw err
        }
    }

    if (prismaTx) {
        return await execute(prismaTx)
    }

    return await prisma.$transaction(async (tx) => {
        return await execute(tx)
    })
}

/**
 * Approves a journal entry, changing its status from DRAFT back to APPROVED.
 * This checks that the entry is balanced and that the accounting period is open.
 * 
 * @param tenantId - The unique ID of the tenant.
 * @param entryId - The ID of the journal entry to approve.
 * @param userId - The ID of the user performing the approval.
 */
export async function approveJournalEntry(tenantId: string, entryId: string, userId: string) {
    const entry = await prisma.journalEntry.findUnique({
        where: { id: entryId },
        include: { lines: true }
    })

    if (!entry || entry.tenantId !== tenantId) throw new Error('Entry not found')
    if (entry.status !== 'DRAFT') throw new Error('Entry is not in DRAFT state')

    // Validate Balance (Tolerance 0.01)
    const diff = Math.abs(entry.totalDebit - entry.totalCredit)
    if (diff > 0.01) {
        throw new Error(`Entry is not balanced. Diff: ${diff}`)
    }

    // Validate period is not closed
    await validatePeriodNotClosed(tenantId, entry.date)

    const updated = await prisma.journalEntry.update({
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

    // Log approval
    await logAction(tenantId, 'JOURNAL_ENTRY', updated.id, 'APPROVED', userId, {
        number: updated.number,
        description: updated.description
    }, prisma) // approveJournalEntry currently doesn't take prismaTx, but uses global prisma. 
    // Wait, let's fix approveJournalEntry too if possible, but let's stick to logAction fix.

    return updated
}

/**
 * Annuls a journal entry. 
 * The entry remains in the database for audit purposes but its status is changed to ANNULLED.
 * 
 * @param tenantId - The ID of the tenant.
 * @param entryId - The ID of the entry to annul.
 * @param userId - The ID of the user performing the annulment.
 */
export async function annulJournalEntry(tenantId: string, entryId: string, userId: string) {
    const entry = await prisma.journalEntry.findUnique({
        where: { id: entryId }
    })

    if (!entry || entry.tenantId !== tenantId) throw new Error('Entry not found')
    if (entry.status === 'ANNULLED') throw new Error('Entry is already annulled')

    // Validate period is not closed before annulling
    await validatePeriodNotClosed(tenantId, entry.date)

    const updated = await prisma.journalEntry.update({
        where: { id: entryId },
        data: {
            status: 'ANNULLED'
            // We keep the original lines so there's a record, 
            // but in reports we filter out ANNULLED entries.
        }
    })

    await logAction(tenantId, 'JOURNAL_ENTRY', updated.id, 'ANNULLED', userId, {
        number: updated.number,
        reason: 'User annulled the entry'
    }, prisma)

    return updated
}

/**
 * Fetches a list of journal entries based on the provided filters.
 * 
 * @param tenantId - The ID of the tenant.
 * @param filters - Optional filters for status, start date, and end date.
 */
export async function getJournalEntries(tenantId: string, filters?: { status?: string, start?: Date, end?: Date }) {
    const where: any = { tenantId }
    if (filters?.status && filters.status !== 'ALL') where.status = filters.status
    if (filters?.start && filters?.end) {
        where.date = {
            gte: filters.start,
            lte: filters.end
        }
    }

    return await prisma.journalEntry.findMany({
        where,
        orderBy: { date: 'desc' },
        include: { createdBy: { select: { name: true } } }
    })
}


export async function getJournalEntry(tenantId: string, id: string) {
    return await prisma.journalEntry.findFirst({
        where: { id, tenantId },
        include: { lines: { include: { account: true } }, createdBy: true }
    })
}

/**
 * Retrieves a detailed list of journal lines (ledger view) with optional filters.
 * Useful for building general ledger reports or account statements.
 * 
 * @param tenantId - The ID of the tenant.
 * @param filters - Filters for account, third party, and date range.
 */
export async function getJournalLines(tenantId: string, filters?: { accountId?: string, thirdPartyId?: string, start?: Date, end?: Date }) {
    const where: any = {
        journalEntry: { tenantId }
    }

    // Filters
    if (filters?.accountId) where.accountId = filters.accountId
    if (filters?.thirdPartyId) where.thirdPartyId = filters.thirdPartyId

    if (filters?.start && filters?.end) {
        where.journalEntry.date = {
            gte: filters.start,
            lte: filters.end
        }
    } else if (filters?.start) {
        where.journalEntry.date = { gte: filters.start }
    } else if (filters?.end) {
        where.journalEntry.date = { lte: filters.end }
    }

    return await prisma.journalEntryLine.findMany({
        where,
        include: {
            account: { select: { code: true, name: true } },
            accountingThirdParty: { select: { name: true, documentNumber: true, documentType: true } },
            customer: { select: { name: true, taxId: true } },
            supplier: { select: { name: true, taxId: true } },
            journalEntry: { select: { date: true, number: true, type: true, status: true } }
        },
        orderBy: {
            journalEntry: { date: 'desc' } // Chronological
        }
    })
}
