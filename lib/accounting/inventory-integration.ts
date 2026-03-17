
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
    userId: string,
    prismaTx?: any
) {
    const client = prismaTx || prisma
    // Get invoice with items and product details
    const invoice = await client.invoice.findUnique({
        where: { id: invoiceId },
        include: {
            items: {
                include: {
                    product: true
                }
            }
        }
    })

    if (!invoice) {
        throw new Error('Invoice not found')
    }

    // Check if entry already exists
    const existing = await client.journalEntry.findFirst({
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
    const config = await getAccountingConfig(tenantId, prismaTx)
    if (!config) {
        throw new Error('Configuración contable no encontrada para la empresa.')
    }

    if (!config.costOfSalesId || !config.inventoryAccountId) {
        const missing: string[] = []
        if (!config.costOfSalesId) missing.push('Costo de Ventas')
        if (!config.inventoryAccountId) missing.push('Inventarios')
        throw new Error(`Configuración contable incompleta: faltan las cuentas de ${missing.join(' y ')}. Por favor, configúrelas en Configuración > Contabilidad.`)
    }

    // Verify accounts exist in the current schema
    if (!config.costOfSales || !config.inventoryAccount) {
        throw new Error('Las cuentas contables configuradas para Costo de Ventas o Inventarios no existen en el Plan de Cuentas de esta empresa. Ejecute la reparación de contabilidad.')
    }

    // Calculate total cost
    let totalCost = 0
    const itemsWithCost: any[] = []

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

    const lines: any[] = []

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
    }, prismaTx)

    // Update entry with source reference
    await client.journalEntry.update({
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
    supplierNit?: string,
    prismaTx?: any
) {
    const client = prismaTx || prisma
    // Get accounting config
    const config = await getAccountingConfig(tenantId, prismaTx)
    
    if (!config) {
        throw new Error('Configuración contable no encontrada para la empresa.')
    }

    if (!config.inventoryAccountId || !config.accountsPayableId) {
        const missing: string[] = []
        if (!config.inventoryAccountId) missing.push('Inventarios')
        if (!config.accountsPayableId) missing.push('Cuentas por Pagar (Proveedores)')
        throw new Error(`Configuración contable incompleta: faltan las cuentas de ${missing.join(' y ')}. Por favor, configúrelas en Configuración > Contabilidad.`)
    }

    // Verify accounts exist in the current schema
    if (!config.inventoryAccount || !config.accountsPayable) {
        throw new Error('Las cuentas contables configuradas para Inventarios o Cuentas por Pagar no existen en el Plan de Cuentas de esta empresa. Ejecute la reparación de contabilidad.')
    }

    const lines: any[] = []

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
    }, prismaTx)

    await client.journalEntry.update({
        where: { id: entry.id },
        data: {
            sourceDocId: purchaseId,
            sourceType: 'PURCHASE'
        }
    })

    return entry
}
