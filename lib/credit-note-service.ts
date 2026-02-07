import { Prisma } from '@prisma/client'
import { generateCreditNoteNumber, calculateCreditNoteTotals } from './credit-note-helpers'
import { createJournalEntryFromCreditNote, reverseCostOfSalesForReturn } from './accounting/credit-note-integration'

export type CreateCreditNoteInput = {
    invoiceId: string
    returnId?: string
    type: 'TOTAL' | 'PARTIAL'
    referenceCode: '20' | '22' // 20 = referenced (anulación), 22 = partial (devolución)
    reason: string
    affectedPeriod?: string // Required for code 22
    items: Array<{
        invoiceItemId?: string
        productId: string
        variantId?: string | null
        description: string
        quantity: number
        unitPrice: number
        discount: number
        taxRate: number
    }>
}

/**
 * Create credit note from return or invoice cancellation
 * This is the centralized service for generating credit notes
 */
export async function createCreditNote(
    prisma: Prisma.TransactionClient | any,
    tenantId: string,
    userId: string,
    input: CreateCreditNoteInput
) {
    // Validate invoice exists
    const invoice = await prisma.invoice.findUnique({
        where: { id: input.invoiceId },
        include: {
            customer: true,
            items: true
        }
    })

    if (!invoice) {
        throw new Error('Invoice not found')
    }

    // Validate that invoice is electronic and accepted
    if (!invoice.electronicStatus || !['SENT', 'ACCEPTED'].includes(invoice.electronicStatus)) {
        throw new Error('Only electronic invoices that have been sent/accepted can have credit notes')
    }

    // Generate credit note number
    const { number, prefix, consecutive } = await generateCreditNoteNumber(prisma, 'NC')

    // Calculate totals
    const totals = calculateCreditNoteTotals(input.items)

    // Create credit note with items
    const creditNote = await prisma.creditNote.create({
        data: {
            number,
            prefix,
            consecutive,
            invoiceId: input.invoiceId,
            returnId: input.returnId || null,
            type: input.type,
            referenceCode: input.referenceCode,
            affectedPeriod: input.affectedPeriod || null,
            reason: input.reason,
            subtotal: totals.subtotal,
            discount: totals.discount,
            tax: totals.tax,
            total: totals.total,
            status: 'PENDING',
            resolutionNumber: invoice.resolutionNumber || null,
            createdById: userId,
            items: {
                create: input.items.map(item => ({
                    invoiceItemId: item.invoiceItemId || null,
                    productId: item.productId,
                    variantId: item.variantId || null,
                    description: item.description,
                    quantity: item.quantity,
                    unitPrice: item.unitPrice,
                    discount: item.discount,
                    taxRate: item.taxRate,
                    subtotal: item.unitPrice * item.quantity
                }))
            }
        },
        include: {
            items: true,
            invoice: true
        }
    })

    return creditNote
}

/**
 * Create credit note with accounting integration
 * This function orchestrates: creditNote creation + journal entries
 */
export async function createCreditNoteWithAccounting(
    prisma: Prisma.TransactionClient | any,
    tenantId: string,
    userId: string,
    input: CreateCreditNoteInput,
    options: {
        reverseInventory?: boolean
        warehouseId?: string
    } = {}
) {
    // Create credit note
    const creditNote = await createCreditNote(prisma, tenantId, userId, input)

    // Create accounting journal entry for credit note
    try {
        await createJournalEntryFromCreditNote(creditNote.id, tenantId, userId)
    } catch (err: any) {
        console.error('Failed to create journal entry for credit note:', err.message)
        // Don't fail the whole operation if accounting config is missing
    }

    // Reverse cost of sales if inventory is being returned
    if (options.reverseInventory && options.warehouseId) {
        try {
            await reverseCostOfSalesForReturn(
                creditNote.id,
                options.warehouseId,
                tenantId,
                userId
            )
        } catch (err: any) {
            console.error('Failed to reverse invoice cost of sales:', err.message)
            // Don't fail the whole operation
        }
    }

    return creditNote
}
