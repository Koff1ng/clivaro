import { PrismaClient } from '@prisma/client'
import { initializePUC } from '../lib/accounting/service'
import { updateAccountingConfig } from '../lib/accounting/config-service'
import { withTenantTx } from '../lib/tenancy'

const prisma = new PrismaClient()

async function repairTenant(tenant: any) {
    console.log(`\n🛠️  Repairing Accounting for: ${tenant.name} (${tenant.slug})`)
    
    try {
        await withTenantTx(tenant.id, async (tx) => {
            // 1. Initialize PUC inside tenant schema
            const result = await initializePUC(tenant.id, tx)
            if (result.initialized) {
                console.log(`   ✅ PUC Initialized: ${result.count} accounts created`)
            } else {
                console.log(`   ℹ️  PUC: ${result.message}`)
            }

            // 2. Fetch critical accounts from tenant schema
            const accounts = await tx.accountingAccount.findMany()
            const findId = (code: string) => accounts.find(a => a.code === code)?.id

            const configData = {
                cashAccountId: findId('110505'),
                bankAccountId: findId('111005'),
                accountsReceivableId: findId('130505'),
                accountsPayableId: findId('2205'),
                inventoryAccountId: findId('1435'),
                salesRevenueId: findId('4135'),
                vatGeneratedId: findId('240805'),
                vatDeductibleId: findId('240810'),
                costOfSalesId: findId('6135'),
            }

            // 3. Update Config inside tenant schema
            await updateAccountingConfig(tenant.id, configData, tx)
            console.log(`   ✅ AccountingConfig updated successfully in tenant schema`)
        })
    } catch (err: any) {
        console.error(`   ❌ Failed to repair tenant ${tenant.slug}: ${err.message}`)
    }
}

async function main() {
    console.log('🚀 Starting Tenant-Scoped Accounting Repair Service...\n')
    const tenants = await prisma.tenant.findMany({
        where: { active: true }
    })

    console.log(`📊 Found ${tenants.length} active tenants to check.\n`)

    for (const tenant of tenants) {
        await repairTenant(tenant)
    }

    console.log('\n🏁 Repair complete.')
    await prisma.$disconnect()
}

main().catch(err => {
    console.error('Fatal error:', err)
    process.exit(1)
})
