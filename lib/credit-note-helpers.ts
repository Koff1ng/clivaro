import { Prisma } from '@prisma/client'

/**
 * Helper to generate next credit note number based on existing notes
 */
export async function generateCreditNoteNumber(
    prisma: Prisma.TransactionClient | any,
    prefix: string = 'NC'
): Promise<{ number: string; prefix: string; consecutive: string }> {
    // Get the latest credit note with this prefix
    const latest = await prisma.creditNote.findFirst({
        where: {
            prefix: prefix
        },
        orderBy: {
            consecutive: 'desc'
        }
    })

    let nextNum = 1
    if (latest?.consecutive) {
        const num = parseInt(latest.consecutive, 10)
        if (!isNaN(num)) {
            nextNum = num + 1
        }
    }

    const consecutive = String(nextNum).padStart(6, '0')
    const number = `${prefix}-${consecutive}`

    return { number, prefix, consecutive }
}

/**
 * Calculate credit note totals from items
 */
export function calculateCreditNoteTotals(items: Array<{
    quantity: number
    unitPrice: number
    discount: number
    taxRate: number
}>): { subtotal: number; discount: number; tax: number; total: number } {
    let subtotal = 0
    let totalDiscount = 0
    let totalTax = 0

    for (const item of items) {
        const lineSubtotal = item.unitPrice * item.quantity
        const lineDiscount = lineSubtotal * (item.discount / 100)
        const lineNet = lineSubtotal - lineDiscount
        const lineTax = lineNet * (item.taxRate / 100)

        subtotal += lineSubtotal
        totalDiscount += lineDiscount
        totalTax += lineTax
    }

    const total = subtotal - totalDiscount + totalTax

    return {
        subtotal: Math.round(subtotal * 100) / 100,
        discount: Math.round(totalDiscount * 100) / 100,
        tax: Math.round(totalTax * 100) / 100,
        total: Math.round(total * 100) / 100
    }
}
