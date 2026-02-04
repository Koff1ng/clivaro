
import { prisma } from '@/lib/db'
import { createJournalEntry } from './journal-service'
import { getAccountingConfig } from './config-service'

/**
 * Create cost of sales entry when products are sold
 * 
 * Entry structure:
 * DEBIT: Cost of Sales
 *   CREDIT: Inventory
 */
export async function createCostOfSalesEntry(
    invoiceId: string,
    tenantId: string,
    userId: string
) {
    // Get invoice with items and product details
    const invoice = await prisma.invoice.findUnique({
        where: { id: invoiceId },
        include: {
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
            sourceType: 'COST_OF_SALES'
        }
    })

    if (existing) {
        console.log(`Cost of sales entry already exists for invoice ${invoiceId}`)
        return existing
    }

    // Get accounting config
    const config = await getAccountingConfig(tenantId)
    if (!config?.costOfSalesId || !config?.inventoryAccountId) {
        throw new Error('Configuración contable incompleta. Configure las cuentas en /accounting/config')
    }

    // Calculate total cost
    let totalCost = 0
    const itemsWithCost = []

    for (const item of invoice.items) {
        // Only track cost for products with inventory tracking
        if (item.product?.trackStock) {
            const itemCost = (item.product.cost || 0) * item.quantity
            totalCost += itemCost
            itemsWithCost.push({
                productName: item.product.name,
                quantity: item.quantity,
                unitCost: item.product.cost || 0,
                totalCost: itemCost
            })
        }
    }

    // If no items with cost, skip
    if (totalCost === 0) {
        console.log(`No cost of sales to record for invoice ${invoiceId}`)
        return null
    }

    const lines = []

    // DEBIT: Cost of Sales
    lines.push({
        accountId: config.costOfSalesId,
        description: `Costo de ventas - Factura ${invoice.number}`,
        debit: totalCost,
        credit: 0
    })

    // CREDIT: Inventory
    lines.push({
        accountId: config.inventoryAccountId,
        description: `Salida de inventario - Factura ${invoice.number}`,
        debit: 0,
        credit: totalCost
    })

    // Create journal entry
    const entry = await createJournalEntry(tenantId, userId, {
        date: invoice.createdAt,
        type: 'COST_SALES',
        description: `Costo de Ventas - Factura ${invoice.number}`,
        reference: invoice.number,
        lines
    })

    // Update entry with source reference
    await prisma.journalEntry.update({
        where: { id: entry.id },
        data: {
            sourceDocId: invoiceId,
            sourceType: 'COST_OF_SALES'
        }
    })

    return entry
}

/**
 * Create inventory purchase entry (when receiving stock)
 */
export async function createInventoryPurchaseEntry(
    purchaseId: string,
    tenantId: string,
    userId: string,
    totalCost: number,
    supplierId?: string,
    supplierName?: string,
    supplierNit?: string
) {
    // Get accounting config
    const config = await getAccountingConfig(tenantId)
    if (!config?.inventoryAccountId || !config?.accountsPayableId) {
        throw new Error('Configuración contable incompleta')
    }

    const lines = []

    // DEBIT: Inventory
    lines.push({
        accountId: config.inventoryAccountId,
        description: `Compra de inventario`,
        debit: totalCost,
        credit: 0
    })

    // CREDIT: Accounts Payable (Supplier)
    lines.push({
        accountId: config.accountsPayableId,
        description: `Proveedor`,
        debit: 0,
        credit: totalCost,
        thirdPartyName: supplierName,
        thirdPartyNit: supplierNit
    })

    const entry = await createJournalEntry(tenantId, userId, {
        date: new Date(),
        type: 'EXPENSE',
        description: `Compra de Inventario`,
        reference: purchaseId,
        lines
    })

    await prisma.journalEntry.update({
        where: { id: entry.id },
        data: {
            sourceDocId: purchaseId,
            sourceType: 'PURCHASE'
        }
    })

    return entry
}
