import { prisma as masterPrisma } from './lib/db'
import { getTenantPrisma } from './lib/tenant-db'

async function auditFull() {
    const tenants = await masterPrisma.tenant.findMany({
        where: { active: true },
        select: { slug: true, databaseUrl: true }
    })

    const results = []

    for (const tenant of tenants) {
        let status = 'OK'
        let error = null
        try {
            const tenantPrisma = getTenantPrisma(tenant.databaseUrl)
            const tables: any[] = await tenantPrisma.$queryRawUnsafe(`
                SELECT table_name 
                FROM information_schema.tables 
                WHERE table_name = 'ElectronicInvoiceTransmission'
                UNION ALL
                SELECT name FROM sqlite_master WHERE type='table' AND name='ElectronicInvoiceTransmission'
            `)

            if (tables.length === 0) {
                status = 'MISSING_TABLE'
            }
        } catch (e: any) {
            status = 'ERROR'
            error = e.message
        }
        results.push({ slug: tenant.slug, status, error, url: tenant.databaseUrl.substring(0, 30) + '...' })
    }

    console.log(JSON.stringify(results, null, 2))
    await masterPrisma.$disconnect()
}

auditFull()
