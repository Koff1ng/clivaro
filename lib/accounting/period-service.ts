
import { prisma } from '@/lib/db'
import { logAction } from './audit-service'

/**
 * Check if a period is closed
 */
export async function isPeriodClosed(
    tenantId: string,
    date: Date
): Promise<boolean> {
    const year = date.getFullYear()
    const month = date.getMonth() + 1

    const period = await prisma.accountingPeriod.findUnique({
        where: {
            tenantId_year_month: { tenantId, year, month }
        }
    })

    return period?.isClosed ?? false
}

/**
 * Validate that period is not closed (throws error if closed)
 */
export async function validatePeriodNotClosed(
    tenantId: string,
    date: Date
) {
    const closed = await isPeriodClosed(tenantId, date)
    if (closed) {
        const year = date.getFullYear()
        const month = date.getMonth() + 1
        throw new Error(`El período ${year}-${String(month).padStart(2, '0')} está cerrado y no permite modificaciones`)
    }
}

/**
 * Close accounting period
 */
export async function closePeriod(
    tenantId: string,
    year: number,
    month: number,
    userId: string
) {
    // Check if already closed
    const existing = await prisma.accountingPeriod.findUnique({
        where: { tenantId_year_month: { tenantId, year, month } }
    })

    if (existing?.isClosed) {
        throw new Error('El período ya está cerrado')
    }

    // Verify all entries in period are approved
    const draftEntries = await prisma.journalEntry.count({
        where: {
            tenantId,
            period: `${year}-${String(month).padStart(2, '0')}`,
            status: 'DRAFT'
        }
    })

    if (draftEntries > 0) {
        throw new Error(`No se puede cerrar el período. Hay ${draftEntries} comprobante(s) en borrador`)
    }

    // Create or update period
    const period = await prisma.accountingPeriod.upsert({
        where: { tenantId_year_month: { tenantId, year, month } },
        create: {
            tenantId,
            year,
            month,
            isClosed: true,
            closedAt: new Date(),
            closedById: userId
        },
        update: {
            isClosed: true,
            closedAt: new Date(),
            closedById: userId
        }
    })

    // Log action
    await logAction(
        tenantId,
        'PERIOD',
        period.id,
        'PERIOD_CLOSED',
        userId,
        { year, month }
    )

    return period
}

/**
 * Reopen accounting period (admin only)
 */
export async function reopenPeriod(
    tenantId: string,
    year: number,
    month: number,
    userId: string
) {
    const period = await prisma.accountingPeriod.findUnique({
        where: { tenantId_year_month: { tenantId, year, month } }
    })

    if (!period) {
        throw new Error('El período no existe')
    }

    if (!period.isClosed) {
        throw new Error('El período ya está abierto')
    }

    const updated = await prisma.accountingPeriod.update({
        where: { id: period.id },
        data: {
            isClosed: false,
            closedAt: null,
            closedById: null
        }
    })

    // Log action
    await logAction(
        tenantId,
        'PERIOD',
        period.id,
        'PERIOD_REOPENED',
        userId,
        { year, month }
    )

    return updated
}

/**
 * Get period status
 */
export async function getPeriodStatus(
    tenantId: string,
    year: number,
    month: number
) {
    const period = await prisma.accountingPeriod.findUnique({
        where: { tenantId_year_month: { tenantId, year, month } }
    })

    return {
        exists: !!period,
        isClosed: period?.isClosed ?? false,
        closedAt: period?.closedAt ?? null,
        closedById: period?.closedById ?? null
    }
}

/**
 * Get all periods for tenant
 */
export async function getPeriods(tenantId: string) {
    return await prisma.accountingPeriod.findMany({
        where: { tenantId },
        orderBy: [
            { year: 'desc' },
            { month: 'desc' }
        ]
    })
}
