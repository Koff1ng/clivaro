import { NextResponse } from 'next/server'
import { logger } from '@/lib/logger'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { Client } from 'pg'
import { getSchemaName } from '@/lib/tenant-utils'
import { TENANT_SQL_STATEMENTS } from '@/lib/tenant-sql-statements'
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

export const dynamic = 'force-dynamic'

function stripSchemaParam(url: string): string {
    try { const u = new URL(url); u.searchParams.delete('schema'); u.searchParams.delete('pgbouncer'); return u.toString() }
    catch { return url }
}
function withSchemaParam(url: string, schema: string): string {
    try { const u = new URL(url); u.searchParams.set('schema', schema); return u.toString() }
    catch { return `${url}?schema=${encodeURIComponent(schema)}` }
}

/**
 * POST /api/admin/tenants/[id]/reset-db
 * Factory-resets a tenant's database:
 * 1. DROP SCHEMA ... CASCADE (removes all data)
 * 2. CREATE SCHEMA (fresh schema)
 * 3. Create all tables via TENANT_SQL_STATEMENTS (same as initializePostgresTenant)
 * 4. Seed admin user, warehouse, ADMIN role
 */
export async function POST(
    _request: Request,
    { params }: { params: { id: string } }
) {
    try {
        const session = await getServerSession(authOptions)
        if (!(session?.user as any)?.isSuperAdmin) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const tenant = await prisma.tenant.findUnique({
            where: { id: params.id },
            select: { id: true, name: true, slug: true },
        })
        if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })

        const schemaName = getSchemaName(tenant.id)
        // Use DIRECT_URL for DDL (bypasses PgBouncer, supports search_path)
        const directBase = stripSchemaParam(process.env.DIRECT_URL || process.env.DATABASE_URL || '')
        const schemaUrl = withSchemaParam(directBase, schemaName)

        logger.info(`[RESET-DB] Starting factory reset for "${tenant.slug}" → schema "${schemaName}"`)

        // STEP 1: Drop and recreate schema
        const baseClient = new Client({ connectionString: directBase })
        try {
            await baseClient.connect()
            await baseClient.query(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`)
            await baseClient.query(`CREATE SCHEMA "${schemaName}"`)
            logger.info(`[RESET-DB] Schema dropped and recreated`)
        } finally {
            await baseClient.end().catch(() => { })
        }

        // STEP 2: Create all tables using TENANT_SQL_STATEMENTS (exact same as initializePostgresTenant)
        const ddlClient = new Client({ connectionString: schemaUrl })
        try {
            await ddlClient.connect()
            await ddlClient.query(`SET search_path TO "${schemaName}"`)
            let executed = 0, skipped = 0
            for (const stmt of TENANT_SQL_STATEMENTS) {
                try {
                    await ddlClient.query(stmt)
                    executed++
                } catch (e: any) {
                    if (e?.message?.includes('already exists') || e?.message?.includes('duplicate')) { skipped++ }
                    else { logger.warn(`[RESET-DB] Stmt warning: ${e?.message?.slice(0, 100)}`) }
                }
            }
            logger.info(`[RESET-DB] ${executed} statements executed, ${skipped} skipped`)
        } finally {
            await ddlClient.end().catch(() => { })
        }

        // STEP 3: Seed initial data via PrismaClient pointing to the tenant schema
        const tenantPrisma = new PrismaClient({ datasources: { db: { url: schemaUrl } } })
        try {
            const hashedPassword = await bcrypt.hash('Admin123!', 10)

            await tenantPrisma.warehouse.upsert({
                where: { name: 'Bodega Principal' }, update: {},
                create: { name: 'Bodega Principal', address: '', active: true },
            })

            const adminUser = await tenantPrisma.user.upsert({
                where: { username: 'admin' },
                update: { password: hashedPassword, active: true },
                create: { username: 'admin', password: hashedPassword, name: 'Administrador', active: true, isSuperAdmin: false },
            })

            const adminRole = await tenantPrisma.role.upsert({
                where: { name: 'ADMIN' }, update: {},
                create: { name: 'ADMIN', description: 'Administrador con acceso total' },
            })

            const corePerms = ['view_reports', 'manage_sales', 'manage_products', 'manage_inventory',
                'manage_customers', 'manage_suppliers', 'manage_purchases', 'manage_users',
                'manage_settings', 'view_dashboard', 'manage_pos', 'manage_cash']

            for (const permName of corePerms) {
                const perm = await tenantPrisma.permission.upsert({
                    where: { name: permName }, update: {},
                    create: { name: permName, description: permName },
                })
                await tenantPrisma.rolePermission.upsert({
                    where: { roleId_permissionId: { roleId: adminRole.id, permissionId: perm.id } },
                    update: {}, create: { roleId: adminRole.id, permissionId: perm.id },
                })
            }

            await tenantPrisma.userRole.upsert({
                where: { userId_roleId: { userId: adminUser.id, roleId: adminRole.id } },
                update: {}, create: { userId: adminUser.id, roleId: adminRole.id },
            })

            logger.info(`[RESET-DB] Initial data seeded successfully`)
        } finally {
            await tenantPrisma.$disconnect()
        }

        return NextResponse.json({
            success: true,
            message: `Base de datos de "${tenant.name}" reiniciada a cero. Todas las tablas recreadas.`,
            schema: schemaName,
            credentials: { username: 'admin', password: 'Admin123!', loginUrl: `/login/${tenant.slug}` }
        })
    } catch (error: any) {
        logger.error('[RESET-DB] Error:', error)
        return NextResponse.json(
            { error: 'Error al reiniciar la base de datos', details: error?.message },
            { status: 500 }
        )
    }
}
