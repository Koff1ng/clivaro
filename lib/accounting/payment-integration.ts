
import { prisma } from '@/lib/db'
import { createJournalEntry } from './journal-service'
import { getAccountingConfig } from './config-service'

/**
 * Create journal entry from payment
 * 
 * Entry structure:
 * DEBIT: Cash/Bank (depending on payment method)
 *   CREDIT: Accounts Receivable (Customer)
 */
export async function createJournalEntryFromPayment(
    paymentId: string,
    tenantId: string,
    userId: string
) {
    // Get payment with invoice and customer details
    const payment = await prisma.payment.findUnique({
        where: { id: paymentId },
        include: {
            invoice: {
                include: {
                    customer: true
                }
            }
        }
    })

    if (!payment || payment.tenantId !== tenantId) {
        throw new Error('Payment not found')
    }

    // Check if entry already exists
    const existing = await prisma.journalEntry.findFirst({
        where: {
            tenantId,
            sourceDocId: paymentId,
            sourceType: 'PAYMENT'
        }
    })

    if (existing) {
        console.log(`Journal entry already exists for payment ${paymentId}`)
        return existing
    }

    // Get accounting config
    const config = await getAccountingConfig(tenantId)
    if (!config?.cashAccountId || !config?.accountsReceivableId) {
        throw new Error('Configuración contable incompleta. Configure las cuentas en /accounting/config')
    }

    // Determine debit account based on payment method
    let debitAccountId: string
    if (payment.method === 'CASH') {
        debitAccountId = config.cashAccountId
    } else if (payment.method === 'CARD' || payment.method === 'TRANSFER') {
        debitAccountId = config.bankAccountId || config.cashAccountId // Fallback to cash if bank not configured
    } else {
        debitAccountId = config.cashAccountId // Default to cash
    }

    const lines = []

    // DEBIT: Cash/Bank
    lines.push({
        accountId: debitAccountId,
        description: `Pago recibido - ${payment.method}`,
        debit: payment.amount,
        credit: 0
    })

    // CREDIT: Accounts Receivable
    lines.push({
        accountId: config.accountsReceivableId,
        description: `Pago de factura ${payment.invoice?.number || ''}`,
        debit: 0,
        credit: payment.amount,
        thirdPartyName: payment.invoice?.customer?.name,
        thirdPartyNit: payment.invoice?.customer?.nit
    })

    // Create journal entry
    const entry = await createJournalEntry(tenantId, userId, {
        date: payment.createdAt,
        type: 'INCOME',
        description: `Pago recibido - ${payment.method} - Factura ${payment.invoice?.number || ''}`,
        reference: `PAY-${payment.id.slice(0, 8)}`,
        lines
    })

    // Update entry with source reference
    await prisma.journalEntry.update({
        where: { id: entry.id },
        data: {
            sourceDocId: paymentId,
            sourceType: 'PAYMENT'
        }
    })

    return entry
}
