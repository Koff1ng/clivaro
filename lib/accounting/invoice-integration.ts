
import { prisma } from '@/lib/db'
import { createJournalEntry } from './journal-service'
import { getAccountingConfig } from './config-service'

/**
 * Create journal entry automatically from an invoice
 * 
 * Entry structure for sale:
 * DEBIT: Accounts Receivable (Customer)
 *   CREDIT: Sales Revenue
 *   CREDIT: VAT Generated
 */
export async function createJournalEntryFromInvoice(
    invoiceId: string,
    tenantId: string,
    userId: string
) {
    // Get invoice with details
    const invoice = await prisma.invoice.findUnique({
        where: { id: invoiceId },
        include: {
            customer: true,
            items: {
                include: {
                    product: true
                }
            }
        }
    })

    if (!invoice || invoice.tenantId !== tenantId) {
        throw new Error('Invoice not found')
    }

    // Check if entry already exists
    const existing = await prisma.journalEntry.findFirst({
        where: {
            tenantId,
            sourceDocId: invoiceId,
            sourceType: 'INVOICE'
        }
    })

    if (existing) {
        console.log(`Journal entry already exists for invoice ${invoiceId}`)
        return existing
    }

    // Get accounting config
    const config = await getAccountingConfig(tenantId)
    if (!config?.accountsReceivableId || !config?.salesRevenueId || !config?.vatGeneratedId) {
        throw new Error('Configuración contable incompleta. Configure las cuentas en /accounting/config')
    }

    // Calculate amounts
    const subtotal = invoice.subtotal
    const taxAmount = invoice.tax
    const total = invoice.total

    // Build journal entry lines
    const lines = []

    // DEBIT: Accounts Receivable (Customer)
    lines.push({
        accountId: config.accountsReceivableId,
        description: `Factura ${invoice.number}`,
        debit: total,
        credit: 0,
        thirdPartyName: invoice.customer?.name,
        thirdPartyNit: invoice.customer?.nit
    })

    // CREDIT: Sales Revenue
    lines.push({
        accountId: config.salesRevenueId,
        description: `Ingresos por venta - Factura ${invoice.number}`,
        debit: 0,
        credit: subtotal
    })

    // CREDIT: VAT Generated
    if (taxAmount > 0) {
        lines.push({
            accountId: config.vatGeneratedId,
            description: `IVA Generado - Factura ${invoice.number}`,
            debit: 0,
            credit: taxAmount
        })
    }

    // Create journal entry
    const entry = await createJournalEntry(tenantId, userId, {
        date: invoice.createdAt,
        type: 'INCOME',
        description: `Venta - Factura ${invoice.number}`,
        reference: invoice.number,
        lines
    })

    // Update entry with source reference
    await prisma.journalEntry.update({
        where: { id: entry.id },
        data: {
            sourceDocId: invoiceId,
            sourceType: 'INVOICE'
        }
    })

    return entry
}

/**
 * Create reversal entry for annulled invoice
 */
export async function reverseInvoiceEntry(
    invoiceId: string,
    tenantId: string,
    userId: string
) {
    const originalEntry = await prisma.journalEntry.findFirst({
        where: {
            tenantId,
            sourceDocId: invoiceId,
            sourceType: 'INVOICE'
        },
        include: { lines: true }
    })

    if (!originalEntry) {
        console.log(`No journal entry found for invoice ${invoiceId}`)
        return null
    }

    // Create reversal (swap debits and credits)
    const reversalLines = originalEntry.lines.map(line => ({
        accountId: line.accountId,
        description: `REVERSA - ${line.description}`,
        debit: line.credit,
        credit: line.debit,
        thirdPartyName: line.thirdPartyName,
        thirdPartyNit: line.thirdPartyNit
    }))

    const reversalEntry = await createJournalEntry(tenantId, userId, {
        date: new Date(),
        type: 'JOURNAL',
        description: `ANULACIÓN - ${originalEntry.description}`,
        reference: originalEntry.reference,
        lines: reversalLines
    })

    await prisma.journalEntry.update({
        where: { id: reversalEntry.id },
        data: {
            sourceDocId: invoiceId,
            sourceType: 'INVOICE_REVERSAL'
        }
    })

    return reversalEntry
}
