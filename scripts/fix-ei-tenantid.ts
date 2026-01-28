
import { prisma as masterPrisma } from '../lib/db'
import { getTenantPrisma } from '../lib/tenant-db'

async function fixTenantId() {
    console.log('🚀 Starting Migration to add tenantId to Electronic Invoicing tables...')
    const tenants = await masterPrisma.tenant.findMany({
        where: { active: true },
        select: { id: true, slug: true, databaseUrl: true }
    })

    for (const tenant of tenants) {
        console.log(`\nProcessing tenant: ${tenant.slug} (${tenant.id})`)
        try {
            const tenantPrisma = getTenantPrisma(tenant.databaseUrl)

            // 1. ElectronicInvoiceTransmission
            // Check if column exists
            const columnTransmission: any[] = await tenantPrisma.$queryRawUnsafe(`
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name = 'ElectronicInvoiceTransmission' AND column_name = 'tenantId'
            `)

            if (columnTransmission.length === 0) {
                console.log('  - Adding tenantId to ElectronicInvoiceTransmission...')
                await tenantPrisma.$executeRawUnsafe(`ALTER TABLE "ElectronicInvoiceTransmission" ADD COLUMN "tenantId" TEXT;`)
                await tenantPrisma.$executeRawUnsafe(`UPDATE "ElectronicInvoiceTransmission" SET "tenantId" = '${tenant.id}';`)
                await tenantPrisma.$executeRawUnsafe(`ALTER TABLE "ElectronicInvoiceTransmission" ALTER COLUMN "tenantId" SET NOT NULL; `)
            } else {
                console.log('  - tenantId already exists in ElectronicInvoiceTransmission.')
            }

            // 2. ElectronicInvoiceEvent
            const columnEvent: any[] = await tenantPrisma.$queryRawUnsafe(`
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name = 'ElectronicInvoiceEvent' AND column_name = 'tenantId'
                    `)

            if (columnEvent.length === 0) {
                console.log('  - Adding tenantId to ElectronicInvoiceEvent...')
                await tenantPrisma.$executeRawUnsafe(`ALTER TABLE "ElectronicInvoiceEvent" ADD COLUMN "tenantId" TEXT; `)
                await tenantPrisma.$executeRawUnsafe(`UPDATE "ElectronicInvoiceEvent" SET "tenantId" = '${tenant.id}';`)
                await tenantPrisma.$executeRawUnsafe(`ALTER TABLE "ElectronicInvoiceEvent" ALTER COLUMN "tenantId" SET NOT NULL; `)
            } else {
                console.log('  - tenantId already exists in ElectronicInvoiceEvent.')
            }

            // 3. Re-create indices to include tenantId (matching schema.prisma)
            console.log('  - Refreshing indices...')
            await tenantPrisma.$executeRawUnsafe(`DROP INDEX IF EXISTS "ElectronicInvoiceTransmission_invoiceId_idx"; `)
            await tenantPrisma.$executeRawUnsafe(`DROP INDEX IF EXISTS "ElectronicInvoiceEvent_transmissionId_idx"; `)

            await tenantPrisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "ElectronicInvoiceTransmission_tenantId_invoiceId_key" ON "ElectronicInvoiceTransmission"("tenantId", "invoiceId"); `)
            await tenantPrisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "ElectronicInvoiceTransmission_tenantId_status_idx" ON "ElectronicInvoiceTransmission"("tenantId", "status"); `)
            await tenantPrisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "ElectronicInvoiceTransmission_tenantId_createdAt_idx" ON "ElectronicInvoiceTransmission"("tenantId", "createdAt"); `)
            await tenantPrisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "ElectronicInvoiceEvent_transmissionId_createdAt_idx" ON "ElectronicInvoiceEvent"("transmissionId", "createdAt"); `)

            console.log(`  ✅ Tenant ${tenant.slug} updated successfully.`)

        } catch (e: any) {
            console.error(`  ❌ Failed for tenant ${tenant.slug}: `, e.message)
        }
    }

    console.log('\n✅ Migration completed.')
    await masterPrisma.$disconnect()
}

fixTenantId()
