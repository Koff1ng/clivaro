import { prisma as masterPrisma } from './lib/db'
import { getTenantPrisma } from './lib/tenant-db'

async function fixProduction() {
    console.log('🚀 Starting Production Fix...')
    const tenants = await masterPrisma.tenant.findMany({
        where: { active: true },
        select: { slug: true, databaseUrl: true }
    })

    for (const tenant of tenants) {
        console.log(`\nFixing tenant: ${tenant.slug}`)
        try {
            const tenantPrisma = getTenantPrisma(tenant.databaseUrl)

            // 1. Add columns to Invoice table
            console.log('  - Adding columns to Invoice table...')
            await tenantPrisma.$executeRawUnsafe(`
                ALTER TABLE "Invoice" 
                ADD COLUMN IF NOT EXISTS "cufe" TEXT,
                ADD COLUMN IF NOT EXISTS "qrCode" TEXT,
                ADD COLUMN IF NOT EXISTS "electronicStatus" TEXT,
                ADD COLUMN IF NOT EXISTS "electronicSentAt" TIMESTAMP,
                ADD COLUMN IF NOT EXISTS "electronicResponse" JSONB,
                ADD COLUMN IF NOT EXISTS "resolutionNumber" TEXT;
            `)

            // 2. Create ElectronicInvoiceTransmission table
            console.log('  - Creating ElectronicInvoiceTransmission table...')
            await tenantPrisma.$executeRawUnsafe(`
                CREATE TABLE IF NOT EXISTS "ElectronicInvoiceTransmission" (
                    "id" TEXT PRIMARY KEY,
                    "invoiceId" TEXT NOT NULL,
                    "provider" TEXT NOT NULL DEFAULT 'ALEGRA',
                    "status" TEXT NOT NULL DEFAULT 'QUEUED',
                    "attemptCount" INTEGER NOT NULL DEFAULT 0,
                    "lastAttemptAt" TIMESTAMP,
                    "alegraInvoiceId" TEXT,
                    "lastErrorMessage" TEXT,
                    "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
            `)

            // 3. Create ElectronicInvoiceEvent table
            console.log('  - Creating ElectronicInvoiceEvent table...')
            await tenantPrisma.$executeRawUnsafe(`
                CREATE TABLE IF NOT EXISTS "ElectronicInvoiceEvent" (
                    "id" TEXT PRIMARY KEY,
                    "transmissionId" TEXT NOT NULL,
                    "eventType" TEXT NOT NULL,
                    "payloadSanitized" JSONB,
                    "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
            `)

            // 4. Create indices
            console.log('  - Creating indices...')
            await tenantPrisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "ElectronicInvoiceTransmission_invoiceId_idx" ON "ElectronicInvoiceTransmission"("invoiceId");`)
            await tenantPrisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "ElectronicInvoiceEvent_transmissionId_idx" ON "ElectronicInvoiceEvent"("transmissionId");`)

            console.log(`  ✅ Tenant ${tenant.slug} updated successfully.`)

        } catch (e: any) {
            console.error(`  ❌ Failed for tenant ${tenant.slug}:`, e.message)
        }
    }

    console.log('\n✅ All production fixes attempted.')
    await masterPrisma.$disconnect()
}

fixProduction()
