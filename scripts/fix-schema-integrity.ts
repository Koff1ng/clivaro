
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient() as any

async function main() {
    /*
    // --- InvoiceLineTax ---
    console.log('Checking for orphaned InvoiceLineTax records...')
    const invoiceItems = await prisma.invoiceItem.findMany({ select: { id: true } })
    const invoiceItemIds = new Set(invoiceItems.map(i => i.id))

    const taxes = await prisma.invoiceLineTax.findMany({ select: { id: true, invoiceItemId: true } })
    const orphans = taxes.filter(t => !invoiceItemIds.has(t.invoiceItemId))

    if (orphans.length > 0) {
        console.log(`Found ${orphans.length} orphaned InvoiceLineTax records. Deleting...`)
        await prisma.invoiceLineTax.deleteMany({ where: { id: { in: orphans.map(o => o.id) } } })
        console.log(`Deleted ${orphans.length} records.`)
    } else {
        console.log('No orphaned InvoiceLineTax records found, database is clean.')
    }
    */

    // --- InvoiceTaxSummary ---
    console.log('Checking for orphaned InvoiceTaxSummary records...')
    const invoices = await prisma.invoice.findMany({ select: { id: true } })
    const invoiceIds = new Set(invoices.map((i: any) => i.id))

    const summaries = await prisma.invoiceTaxSummary.findMany({ select: { id: true, invoiceId: true } })
    const orphanSummaries = summaries.filter((t: any) => !invoiceIds.has(t.invoiceId))

    if (orphanSummaries.length > 0) {
        console.log(`Found ${orphanSummaries.length} orphaned InvoiceTaxSummary records. Deleting...`)
        await prisma.invoiceTaxSummary.deleteMany({ where: { id: { in: orphanSummaries.map((o: any) => o.id) } } })
        console.log(`Deleted ${orphanSummaries.length} records.`)
    } else {
        console.log('No orphaned InvoiceTaxSummary records found, database is clean.')
    }

    // --- CreditNote tables (if populated) ---
    // Just in case, though less likely to be populated yet

    /*
    // --- CreditNoteLineTax ---
    console.log('Checking for orphaned CreditNoteLineTax records...')
    const creditNoteItems = await prisma.creditNoteItem.findMany({ select: { id: true } })
    const creditNoteItemIds = new Set(creditNoteItems.map((i: any) => i.id))

    const creditNoteLineTaxes = await prisma.creditNoteLineTax.findMany({ select: { id: true, creditNoteItemId: true } })
    const creditNoteLineTaxOrphans = creditNoteLineTaxes.filter((t: any) => !creditNoteItemIds.has(t.creditNoteItemId))

    if (creditNoteLineTaxOrphans.length > 0) {
        console.log(`Found ${creditNoteLineTaxOrphans.length} orphaned CreditNoteLineTax records. Deleting...`)
        await prisma.creditNoteLineTax.deleteMany({ where: { id: { in: creditNoteLineTaxOrphans.map(o => o.id) } } })
        console.log(`Deleted ${creditNoteLineTaxOrphans.length} records.`)
    } else {
        console.log('No orphaned CreditNoteLineTax records found, database is clean.')
    }

    // --- CreditNoteTaxSummary ---
    console.log('Checking for orphaned CreditNoteTaxSummary records...')
    const creditNotes = await prisma.creditNote.findMany({ select: { id: true } })
    const creditNoteIds = new Set(creditNotes.map((i: any) => i.id))

    const creditNoteTaxSummaries = await prisma.creditNoteTaxSummary.findMany({ select: { id: true, creditNoteId: true } })
    const creditNoteTaxSummaryOrphans = creditNoteTaxSummaries.filter((t: any) => !creditNoteIds.has(t.creditNoteId))

    if (creditNoteTaxSummaryOrphans.length > 0) {
        console.log(`Found ${creditNoteTaxSummaryOrphans.length} orphaned CreditNoteTaxSummary records. Deleting...`)
        await prisma.creditNoteTaxSummary.deleteMany({ where: { id: { in: creditNoteTaxSummaryOrphans.map(o => o.id) } } })
        console.log(`Deleted ${creditNoteTaxSummaryOrphans.length} records.`)
    } else {
        console.log('No orphaned CreditNoteTaxSummary records found, database is clean.')
    }
    */
}

main()
    .catch((e) => {
        console.error(e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
