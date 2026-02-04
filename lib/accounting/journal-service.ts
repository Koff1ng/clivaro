
import { prisma } from '@/lib/prisma'

export type JournalEntryInput = {
    date: Date
    type: string
    description: string
    reference?: string
    lines: Array<{
        accountId: string
        description?: string
        debit?: number
        credit?: number
        thirdPartyId?: string
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

    return await prisma.$transaction(async (tx) => {
        const count = await tx.journalEntry.count({
            where: { tenantId, period }
        })
        const number = `${period}-${String(count + 1).padStart(4, '0')}`

        const entry = await tx.journalEntry.create({
            data: {
                tenantId,
                number,
                date: data.date,
                period,
                type: data.type,
                description: data.description,
                reference: data.reference,
                status: 'DRAFT',
                totalDebit,
                totalCredit,
                createdById: userId,
                lines: {
                    create: data.lines.map(l => ({
                        accountId: l.accountId,
                        description: l.description || data.description,
                        debit: l.debit || 0,
                        credit: l.credit || 0,
                        thirdPartyId: l.thirdPartyId,
                        thirdPartyName: l.thirdPartyName,
                        thirdPartyNit: l.thirdPartyNit
                    }))
                }
            },
            include: { lines: true }
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

    return await prisma.journalEntry.update({
        where: { id: entryId },
        data: {
            status: 'APPROVED',
            approvedById: userId,
            approvedAt: new Date()
        }
    })
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
