
import { prisma } from '@/lib/db'
import { createJournalEntry } from './journal-service'
import { getAccountingConfig } from './config-service'

/**
 * Create journal entry for credit note (return/reversal of sale)
 * 
 * Entry structure for credit note:
 * DEBIT: Sales Revenue (contra-income, reduces revenue)
 * DEBIT: VAT Generated (reverses VAT)
 *   CREDIT: Accounts Receivable (reduces customer debt)
 * 
 * This reverses the original sale entry.
 */
export async function createJournalEntryFromCreditNote(
    creditNoteId: string,
    tenantId: string,
    userId: string
) {
    // Get credit note with details
    const creditNote = await prisma.creditNote.findUnique({
        where: { id: creditNoteId },
        include: {
            invoice: {
                include: {
                    customer: true
                }
            },
            items: true
        }
    })

    if (!creditNote) {
        throw new Error('Credit note not found')
    }

    // Check if entry already exists
    const existing = await prisma.journalEntry.findFirst({
        where: {
            tenantId,
            sourceDocId: creditNoteId,
            sourceType: 'CREDIT_NOTE'
        }
    })

    if (existing) {
        console.log(`Journal entry already exists for credit note ${creditNoteId}`)
        return existing
    }

    // Get accounting config
    const config = await getAccountingConfig(tenantId)
    if (!config?.accountsReceivableId || !config?.salesRevenueId || !config?.vatGeneratedId) {
        throw new Error('Configuración contable incompleta. Configure las cuentas en /accounting/config')
    }

    // Calculate amounts
    const subtotal = creditNote.subtotal
    const taxAmount = creditNote.tax
    const total = creditNote.total

    // Build journal entry lines
    const lines = []

    // DEBIT: Sales Revenue (contra-income)
    lines.push({
        accountId: config.salesRevenueId,
        description: `Devolución venta - Nota Crédito ${creditNote.number}`,
        debit: subtotal,
        credit: 0
    })

    // DEBIT: VAT Generated (reversal)
    if (taxAmount > 0) {
        lines.push({
            accountId: config.vatGeneratedId,
            description: `Reversión IVA - Nota Crédito ${creditNote.number}`,
            debit: taxAmount,
            credit: 0
        })
    }

    // CREDIT: Accounts Receivable (reduce customer debt)
    lines.push({
        accountId: config.accountsReceivableId,
        description: `Nota Crédito ${creditNote.number}`,
        debit: 0,
        credit: total,
        thirdPartyName: creditNote.invoice?.customer?.name,
        thirdPartyNit: creditNote.invoice?.customer?.taxId || undefined
    })

    // Create journal entry
    const entry = await createJournalEntry(tenantId, userId, {
        date: creditNote.createdAt,
        type: 'JOURNAL',
        description: `Nota Crédito - ${creditNote.number} - Factura ${creditNote.invoice?.number}`,
        reference: creditNote.number,
        lines
    })

    // Update entry with source reference
    await prisma.journalEntry.update({
        where: { id: entry.id },
        data: {
            sourceDocId: creditNoteId,
            sourceType: 'CREDIT_NOTE'
        }
    })

    return entry
}

/**
 * Reverse cost of sales for returned items
 * 
 * Entry structure:
 * DEBIT: Inventory (increase inventory back)
 *   CREDIT: Cost of Sales (reduce cost)
 * 
 * This is called when items are physically returned to inventory.
 */
export async function reverseCostOfSalesForReturn(
    creditNoteId: string,
    warehouseId: string,
    tenantId: string,
    userId: string
) {
    // Get credit note with items
    const creditNote = await prisma.creditNote.findUnique({
        where: { id: creditNoteId },
        include: {
            invoice: true,
            items: {
                include: {
                    product: true,
                    variant: true
                }
            }
        }
    })

    if (!creditNote) {
        throw new Error('Credit note not found')
    }

    // Check if cost reversal entry already exists
    const existing = await prisma.journalEntry.findFirst({
        where: {
            tenantId,
            sourceDocId: creditNoteId,
            sourceType: 'CREDIT_NOTE_COST_REVERSAL'
        }
    })

    if (existing) {
        console.log(`Cost reversal entry already exists for credit note ${creditNoteId}`)
        return existing
    }

    // Get accounting config
    const config = await getAccountingConfig(tenantId)
    if (!config?.inventoryAccountId || !config?.costOfSalesId) {
        throw new Error('Configuración contable incompleta para reversión de costos')
    }

    // Calculate total cost of returned items
    let totalCost = 0
    for (const item of creditNote.items) {
        const cost = item.variant?.cost || item.product.cost
        totalCost += cost * item.quantity
    }

    // Only create entry if there's actualcost to reverse
    if (totalCost <= 0) {
        console.log(`No cost to reverse for credit note ${creditNoteId}`)
        return null
    }

    // Build journal entry
    const lines = []

    // DEBIT: Inventory (items back in stock)
    lines.push({
        accountId: config.inventoryAccountId,
        description: `Devolución inventario - NC ${creditNote.number}`,
        debit: totalCost,
        credit: 0
    })

    // CREDIT: Cost of Sales (reduce expense)
    lines.push({
        accountId: config.costOfSalesId,
        description: `Reversión costo venta - NC ${creditNote.number}`,
        debit: 0,
        credit: totalCost
    })

    // Create journal entry
    const entry = await createJournalEntry(tenantId, userId, {
        date: creditNote.createdAt,
        type: 'JOURNAL',
        description: `Reversión Costo Ventas - NC ${creditNote.number}`,
        reference: creditNote.number,
        lines
    })

    // Update with source reference
    await prisma.journalEntry.update({
        where: { id: entry.id },
        data: {
            sourceDocId: creditNoteId,
            sourceType: 'CREDIT_NOTE_COST_REVERSAL'
        }
    })

    return entry
}
