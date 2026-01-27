import { prisma as masterPrisma } from './lib/db'
import { getTenantPrisma } from './lib/tenant-db'

async function auditProduction() {
    console.log('🔍 Starting Production Audit...')
    const tenants = await masterPrisma.tenant.findMany({
        where: { active: true },
        select: { slug: true, databaseUrl: true }
    })

    const results = []

    for (const tenant of tenants) {
        console.log(`Checking ${tenant.slug}...`)
        const result: any = { slug: tenant.slug, tables: 'MISSING', columns: 'MISSING' }
        try {
            const tenantPrisma = getTenantPrisma(tenant.databaseUrl)

            // Check Table
            const tableCheck: any[] = await tenantPrisma.$queryRawUnsafe(`
                SELECT table_name FROM information_schema.tables 
                WHERE table_name = 'ElectronicInvoiceTransmission'
            `)
            result.tables = tableCheck.length > 0 ? 'OK' : 'MISSING'

            // Check Column
            const columnCheck: any[] = await tenantPrisma.$queryRawUnsafe(`
                SELECT column_name FROM information_schema.columns 
                WHERE table_name = 'Invoice' AND column_name = 'cufe'
            `)
            result.columns = columnCheck.length > 0 ? 'OK' : 'MISSING'

        } catch (e: any) {
            result.error = e.message
        }
        results.push(result)
    }

    console.log('\n--- AUDIT RESULTS ---')
    console.table(results)
    await masterPrisma.$disconnect()
}

auditProduction()
