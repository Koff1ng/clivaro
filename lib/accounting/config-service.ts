
import { prisma } from '@/lib/db'

export type AccountingConfigData = {
    cashAccountId?: string
    bankAccountId?: string
    accountsReceivableId?: string
    accountsPayableId?: string
    inventoryAccountId?: string
    salesRevenueId?: string
    vatGeneratedId?: string
    vatDeductibleId?: string
    costOfSalesId?: string
}

/**
 * Get accounting configuration for tenant
 */
export async function getAccountingConfig(tenantId: string) {
    return await prisma.accountingConfig.findUnique({
        where: { tenantId },
        include: {
            cashAccount: true,
            bankAccount: true,
            accountsReceivable: true,
            accountsPayable: true,
            inventoryAccount: true,
            salesRevenue: true,
            vatGenerated: true,
            vatDeductible: true,
            costOfSales: true
        }
    })
}

/**
 * Update or create accounting configuration
 */
export async function updateAccountingConfig(
    tenantId: string,
    data: AccountingConfigData
) {
    return await prisma.accountingConfig.upsert({
        where: { tenantId },
        create: {
            tenantId,
            ...data
        },
        update: data
    })
}

/**
 * Validate that all required accounts are configured
 */
export async function validateConfig(tenantId: string): Promise<{
    isValid: boolean
    missingAccounts: string[]
}> {
    const config = await getAccountingConfig(tenantId)

    if (!config) {
        return {
            isValid: false,
            missingAccounts: ['Configuración no existe']
        }
    }

    const requiredFields = [
        'cashAccountId',
        'accountsReceivableId',
        'salesRevenueId',
        'vatGeneratedId',
        'costOfSalesId',
        'inventoryAccountId'
    ]

    const missing: string[] = []

    if (!config.cashAccountId) missing.push('Cuenta de Caja')
    if (!config.accountsReceivableId) missing.push('Cuenta de Clientes')
    if (!config.salesRevenueId) missing.push('Cuenta de Ingresos')
    if (!config.vatGeneratedId) missing.push('Cuenta de IVA Generado')
    if (!config.costOfSalesId) missing.push('Cuenta de Costo de Ventas')
    if (!config.inventoryAccountId) missing.push('Cuenta de Inventarios')

    return {
        isValid: missing.length === 0,
        missingAccounts: missing
    }
}

/**
 * Get specific account ID from config (helper)
 */
export async function getConfigAccountId(
    tenantId: string,
    accountType: keyof AccountingConfigData
): Promise<string | null> {
    const config = await getAccountingConfig(tenantId)
    return config?.[accountType] || null
}
