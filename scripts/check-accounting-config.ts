import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
    console.log('--- Accounting Configuration Diagnostic ---')
    const tenants = await prisma.tenant.findMany({
        include: {
            accountingConfig: {
                include: {
                    inventoryAccount: true,
                    accountsPayable: true,
                    costOfSales: true,
                    cashAccount: true,
                    accountsReceivable: true,
                    salesRevenue: true,
                    vatGenerated: true,
                    vatDeductible: true,
                    bankAccount: true
                }
            }
        }
    })

    for (const tenant of tenants) {
        console.log(`\nTenant: ${tenant.name} (${tenant.id}) [${tenant.slug}]`)
        const config = tenant.accountingConfig
        if (!config) {
            console.log('  [!] No accounting configuration found')
            continue
        }

        const checkAccount = (name: string, id: string | null, relation: any) => {
            if (!id) {
                console.log(`  [!] ${name}: Missing ID`)
            } else if (!relation) {
                console.log(`  [X] ${name}: ID "${id}" provided but ACCOUNT DOES NOT EXIST in AccountingAccount table`)
            } else if (relation.tenantId !== tenant.id) {
                console.log(`  [X] ${name}: ID "${id}" (${relation.name}) belongs to TENANT "${relation.tenantId}", which is DIFFERENT from current tenant "${tenant.id}"`)
            } else {
                console.log(`  [OK] ${name}: ID "${id}" (${relation.name}) [Correct Tenant]`)
            }
        }

        checkAccount('Inventory Account', config.inventoryAccountId, config.inventoryAccount)
        checkAccount('Accounts Payable', config.accountsPayableId, config.accountsPayable)
        checkAccount('Cost of Sales', config.costOfSalesId, config.costOfSales)
        checkAccount('Cash Account', config.cashAccountId, config.cashAccount)
        checkAccount('Accounts Receivable', config.accountsReceivableId, config.accountsReceivable)
        checkAccount('Sales Revenue', config.salesRevenueId, config.salesRevenue)
        checkAccount('VAT Generated', config.vatGeneratedId, config.vatGenerated)
        checkAccount('VAT Deductible', config.vatDeductibleId, config.vatDeductible)
        checkAccount('Bank Account', config.bankAccountId, config.bankAccount)
    }
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect())
