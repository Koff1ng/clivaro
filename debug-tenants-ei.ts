import { prisma as masterPrisma } from './lib/db'
import { getTenantPrisma } from './lib/tenant-db'

async function debugTenants() {
    console.log('🚀 Checking Electronic Invoicing tables in all active tenants...')

    const tenants = await masterPrisma.tenant.findMany({
        where: { active: true },
        select: { slug: true, databaseUrl: true }
    })

    for (const tenant of tenants) {
        console.log(`\nChecking tenant: ${tenant.slug}`)
        try {
            const tenantPrisma = getTenantPrisma(tenant.databaseUrl)

            // Check table existence
            const tables: any[] = await tenantPrisma.$queryRawUnsafe(`
                SELECT table_name 
                FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'ElectronicInvoiceTransmission'
            `)

            if (tables.length > 0) {
                console.log(`  ✅ ElectronicInvoiceTransmission exists.`)
            } else {
                console.log(`  ❌ ElectronicInvoiceTransmission MISSING.`)

                // Try case-insensitive search
                const allTables: any[] = await tenantPrisma.$queryRawUnsafe(`
                    SELECT table_name FROM information_schema.tables 
                    WHERE table_schema = 'public' AND table_name ILIKE '%Electronic%'
                `)
                console.log(`  Other matching tables:`, allTables.map(t => t.table_name))
            }

            // Check columns in Invoice table
            const columns: any[] = await tenantPrisma.$queryRawUnsafe(`
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name = 'Invoice' AND column_name = 'cufe'
            `)
            if (columns.length > 0) {
                console.log(`  ✅ Invoice.cufe exists.`)
            } else {
                console.log(`  ❌ Invoice.cufe MISSING.`)
            }

        } catch (error: any) {
            console.error(`  ⚠️ Connection/Query error:`, error.message)
        }
    }

    await masterPrisma.$disconnect()
}

debugTenants()
