import { PrismaClient } from '@prisma/client'
import crypto from 'crypto'

const prisma = new PrismaClient()

// Full list of permissions that should exist in every tenant
const ALL_PERMISSIONS = [
    'view_reports',
    'manage_sales',
    'manage_products',
    'manage_inventory',
    'manage_customers',
    'manage_suppliers',
    'manage_purchases',
    'manage_users',
    'manage_settings',
    'view_dashboard',
    'manage_pos',
    'manage_accounting',
    'manage_payroll',
    'manage_crm',
    'manage_cash',
    'manage_returns',
    'void_invoices',
    'apply_discounts',
]

// Simple helper for stable IDs
function getMd5(text: string) {
    return crypto.createHash('md5').update(text).digest('hex')
}

// Helper to get schema name (duplicated from lib/tenant-utils.ts for script isolation)
function getTenantSchemaName(tenantId: string): string {
    return `tenant_${tenantId.toLowerCase()}`
}

async function syncTenantPermissions(tenantId: string, tenantName: string) {
    const schemaName = getTenantSchemaName(tenantId)
    console.log(`\n--- Syncing Tenant: ${tenantName} (${tenantId}) | Schema: ${schemaName} ---`)

    try {
        // Set search_path for this connection
        await prisma.$executeRawUnsafe(`SET search_path TO "${schemaName}", public`)

        // 1. Ensure all permissions exist
        console.log('Ensuring permissions exist...')
        for (const permName of ALL_PERMISSIONS) {
            const permId = `perm_${getMd5(permName)}`
            await prisma.$executeRawUnsafe(`
        INSERT INTO "Permission" (id, name, description)
        VALUES ('${permId}', '${permName}', '${permName}')
        ON CONFLICT (name) DO NOTHING
      `)
        }

        // 2. Find ADMIN role
        const roles: any[] = await prisma.$queryRawUnsafe(`SELECT id FROM "Role" WHERE name = 'ADMIN'`)
        if (roles.length === 0) {
            console.warn(`Role ADMIN not found for tenant ${tenantName}`)
            return
        }
        const adminRoleId = roles[0].id

        // 3. Grant all permissions to ADMIN role
        console.log('Granting all permissions to ADMIN role...')
        const permissions: any[] = await prisma.$queryRawUnsafe(`SELECT id, name FROM "Permission"`)

        for (const perm of permissions) {
            const rpId = `rp_${getMd5(adminRoleId + perm.id)}`
            await prisma.$executeRawUnsafe(`
        INSERT INTO "RolePermission" (id, "roleId", "permissionId")
        VALUES ('${rpId}', '${adminRoleId}', '${perm.id}')
        ON CONFLICT ("roleId", "permissionId") DO NOTHING
      `)
        }

        console.log(`✓ Permissions synced for ${tenantName}`)
    } catch (error: any) {
        console.error(`Error syncing permissions for ${tenantName}:`, error?.message || error)
    }
}

async function main() {
    console.log('Starting global permission synchronization...')

    try {
        // Get all tenants from the main database
        const tenants: any[] = await prisma.tenant.findMany({
            select: { id: true, name: true }
        })

        console.log(`Found ${tenants.length} tenants.`)

        for (const tenant of tenants) {
            await syncTenantPermissions(tenant.id, tenant.name)
        }

        console.log('\nGlobal synchronization completed.')
    } catch (error: any) {
        console.error('Fatal error in main:', error?.message || error)
    } finally {
        await prisma.$disconnect()
    }
}

main().catch(console.error)
