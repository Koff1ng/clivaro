import { PrismaClient } from '@prisma/client'

/**
 * Derives the standardized PostgreSQL schema name for a given tenant ID.
 * Duplicated here to make the script standalone and avoid tsconfig-paths issues in CLI.
 */
function getSchemaName(tenantId: string): string {
    if (!tenantId) throw new Error('tenantId is required to derive schema name')
    return `tenant_${tenantId.toLowerCase().replace(/[^a-z0-9]/g, '_')}`
}

const prisma = new PrismaClient()

async function syncTenantEmailTable(tenantId: string, tenantName: string) {
    const schemaName = getSchemaName(tenantId)
    console.log(`\n--- Syncing Tenant: ${tenantName} (${tenantId}) | Schema: ${schemaName} ---`)

    try {
        // Create the table in the tenant's schema if it doesn't exist
        // Note: We use the same structure as in the public migration for consistency
        await prisma.$executeRawUnsafe(`
            CREATE TABLE IF NOT EXISTS "${schemaName}"."TenantEmailConfig" (
                "id" TEXT PRIMARY KEY,
                "tenantId" TEXT NOT NULL UNIQUE,
                "resendDomainId" TEXT NOT NULL,
                "domain" TEXT NOT NULL,
                "fromEmail" TEXT NOT NULL,
                "fromName" TEXT NOT NULL,
                "dnsRecords" JSONB NOT NULL,
                "verified" BOOLEAN DEFAULT false,
                "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
                "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
        `)

        console.log(`✓ TenantEmailConfig table ensured for ${tenantName}`)
    } catch (error: any) {
        console.error(`Error syncing email table for ${tenantName}:`, error?.message || error)
    }
}

async function main() {
    console.log('Starting global email configuration table synchronization...')

    try {
        // Get all tenants from the main database
        // We use the 'public' prisma client (global one)
        const tenants = await prisma.tenant.findMany({
            select: { id: true, name: true }
        })

        console.log(`Found ${tenants.length} tenants.`)

        for (const tenant of tenants) {
            await syncTenantEmailTable(tenant.id, tenant.name)
        }

        console.log('\nGlobal synchronization completed.')
    } catch (error: any) {
        console.error('Fatal error in main:', error?.message || error)
    } finally {
        await prisma.$disconnect()
    }
}

main().catch(console.error)
