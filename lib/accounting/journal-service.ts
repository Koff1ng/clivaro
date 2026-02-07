
import { prisma } from '@/lib/db'
import { validatePeriodNotClosed } from './period-service'
import { logAction } from './audit-service'

export type JournalEntryInput = {
    date: Date
    type: string
    description: string
    reference?: string
    status?: 'DRAFT' | 'APPROVED'
    lines: Array<{
        accountId: string
        description?: string
        debit?: number
        credit?: number
        accountingThirdPartyId?: string // New field
        thirdPartyId?: string // Legacy/Auto (Customer)
        supplierId?: string // Legacy/Auto (Supplier)
        thirdPartyName?: string
        thirdPartyNit?: string
    }>
}

export async function createJournalEntry(tenantId: string, userId: string, data: JournalEntryInput) {
    // Basic validation
    let totalDebit = 0
    let totalCredit = 0
    data.lines.forEach(l => {
        totalDebit += l.debit || 0
        totalCredit += l.credit || 0
    })

    const date = new Date(data.date)
    const period = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`

    // Validate period is not closed
    await validatePeriodNotClosed(tenantId, date)

    return await prisma.$transaction(async (tx) => {
        const count = await tx.journalEntry.count({
            where: { tenantId, period }
        })
        const number = `${period}-${String(count + 1).padStart(4, '0')}`

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
        })

        return entry
    })
}

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
    })

    return updated
}

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
        include: { createdBy: { select: { name: true } }, lines: false } // Lines heavy
    })
}


export async function getJournalEntry(tenantId: string, id: string) {
    return await prisma.journalEntry.findUnique({
        where: { id },
        include: { lines: { include: { account: true } }, createdBy: true }
    })
}

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
