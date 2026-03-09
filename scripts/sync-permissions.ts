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

        // 2. Define and Sync Roles
        console.log('Syncing roles and role-specific permissions...')
        const defaultRoles = [
            {
                name: 'ADMIN',
                description: 'Administrador total con acceso a todos los módulos y configuraciones.',
                permissions: ALL_PERMISSIONS,
            },
            {
                name: 'CAJERO_POS',
                description: 'Cajero de punto de venta. Puede realizar ventas, devoluciones, manejar caja y cierres de turno.',
                permissions: ['view_dashboard', 'manage_pos', 'manage_sales', 'manage_cash', 'manage_returns', 'void_invoices', 'apply_discounts', 'manage_customers'],
            },
            {
                name: 'VENDEDOR_COMERCIAL',
                description: 'Asesor comercial. Enfocado en gestión de clientes (CRM), cotizaciones y pedidos de venta.',
                permissions: ['view_dashboard', 'manage_sales', 'manage_customers', 'manage_crm'],
            },
            {
                name: 'ALMACENISTA',
                description: 'Gestión de almacén. Control de inventarios, recepción de mercancía y traslados.',
                permissions: ['view_dashboard', 'manage_products', 'manage_inventory', 'manage_suppliers', 'manage_purchases'],
            },
            {
                name: 'CONTADOR',
                description: 'Gestor contable y financiero. Acceso a reportes, balances y libros contables.',
                permissions: ['view_dashboard', 'view_reports', 'manage_accounting'],
            },
            {
                name: 'RECURSOS_HUMANOS',
                description: 'Gestión de personal y nómina. Manejo de empleados y liquidaciones.',
                permissions: ['view_dashboard', 'manage_payroll', 'manage_users'],
            },
            {
                name: 'REST_MESERO',
                description: 'Mesero (Restaurantes). Toma de pedidos y atención en mesa.',
                permissions: ['view_dashboard', 'manage_pos'],
            },
        ]

        for (const roleDef of defaultRoles) {
            const roleId = `role_${getMd5(roleDef.name)}`
            // Upsert role
            await prisma.$executeRawUnsafe(`
                INSERT INTO "Role" (id, name, description, "updatedAt")
                VALUES ('${roleId}', '${roleDef.name}', '${roleDef.description}', NOW())
                ON CONFLICT (name) DO UPDATE SET description = EXCLUDED.description, "updatedAt" = NOW()
            `)

            // Sync permissions for this role
            for (const permName of roleDef.permissions) {
                // Get perm id (consistent with step 1)
                const permId = `perm_${getMd5(permName)}`
                const rpId = `rp_${getMd5(roleId + permId)}`

                await prisma.$executeRawUnsafe(`
                    INSERT INTO "RolePermission" (id, "roleId", "permissionId")
                    VALUES ('${rpId}', '${roleId}', '${permId}')
                    ON CONFLICT ("roleId", "permissionId") DO NOTHING
                `)
            }
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
