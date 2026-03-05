import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { Client } from 'pg'
import { getSchemaName } from '@/lib/tenant-utils'
import { TENANT_SQL_STATEMENTS } from '@/lib/tenant-sql-statements'
import bcrypt from 'bcryptjs'

export const dynamic = 'force-dynamic'

/**
 * POST /api/admin/tenants/[id]/reset-db
 * DANGER: Drops and recreates the tenant schema entirely (factory reset).
 * Wipes all business data and reseeds with a fresh admin user, role, warehouse.
 * Only accessible by super admins.
 */
export async function POST(
    request: Request,
    { params }: { params: { id: string } }
) {
    try {
        const session = await getServerSession(authOptions)
        const user = session?.user as any

        if (!user?.isSuperAdmin) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const tenant = await prisma.tenant.findUnique({
            where: { id: params.id },
            select: { id: true, name: true, slug: true },
        })

        if (!tenant) {
            return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })
        }

        const schemaName = getSchemaName(tenant.id)
        const directUrl = process.env.DIRECT_URL || process.env.DATABASE_URL || ''

        // Strip schema param for raw pg connection
        let baseUrl = directUrl
        try {
            const url = new URL(directUrl)
            url.searchParams.delete('schema')
            url.searchParams.delete('pgbouncer')
            baseUrl = url.toString()
        } catch { /* use as-is */ }

        // Step 1: DROP the schema (removes all tables and data)
        console.log(`[RESET-DB] Dropping schema "${schemaName}" for tenant ${tenant.slug}`)
        const dropClient = new Client({ connectionString: baseUrl })
        try {
            await dropClient.connect()
            await dropClient.query(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`)
            await dropClient.query(`CREATE SCHEMA "${schemaName}"`)
            console.log(`[RESET-DB] Schema "${schemaName}" dropped and recreated`)
        } finally {
            await dropClient.end().catch(() => { })
        }

        // Step 2: Recreate all tables
        console.log(`[RESET-DB] Recreating tables in "${schemaName}"`)
        const ddlUrl = (() => {
            try {
                const url = new URL(baseUrl)
                url.searchParams.set('schema', schemaName)
                return url.toString()
            } catch {
                return `${baseUrl}?schema=${encodeURIComponent(schemaName)}`
            }
        })()

        const ddlClient = new Client({ connectionString: ddlUrl })
        try {
            await ddlClient.connect()
            await ddlClient.query(`SET search_path TO "${schemaName}"`)
            let executed = 0
            for (const stmt of TENANT_SQL_STATEMENTS) {
                try {
                    await ddlClient.query(stmt)
                    executed++
                } catch (e: any) {
                    if (!e.message?.includes('already exists') && !e.message?.includes('duplicate')) {
                        console.warn(`[RESET-DB] Skipping stmt: ${e.message?.slice(0, 80)}`)
                    }
                }
            }
            console.log(`[RESET-DB] ${executed} statements executed`)
        } finally {
            await ddlClient.end().catch(() => { })
        }

        // Step 3: Seed fresh admin user, role, warehouse
        console.log(`[RESET-DB] Seeding initial data for "${schemaName}"`)
        const { PrismaClient } = require('@prisma/client')
        const tenantPrisma = new PrismaClient({ datasources: { db: { url: ddlUrl } } })

        try {
            const hashedPassword = await bcrypt.hash('Admin123!', 10)

            // Warehouse
            await tenantPrisma.warehouse.upsert({
                where: { name: 'Bodega Principal' },
                update: {},
                create: { name: 'Bodega Principal', address: '', active: true },
            })

            // Admin user
            const adminUser = await tenantPrisma.user.upsert({
                where: { username: 'admin' },
                update: { password: hashedPassword, active: true },
                create: { username: 'admin', password: hashedPassword, name: 'Administrador', active: true, isSuperAdmin: false },
            })

            // ADMIN role
            const adminRole = await tenantPrisma.role.upsert({
                where: { name: 'ADMIN' },
                update: {},
                create: { name: 'ADMIN', description: 'Administrador con acceso total' },
            })

            // Core permissions
            const corePerms = ['view_reports', 'manage_sales', 'manage_products', 'manage_inventory',
                'manage_customers', 'manage_suppliers', 'manage_purchases', 'manage_users',
                'manage_settings', 'view_dashboard', 'manage_pos']

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
        } finally {
            await tenantPrisma.$disconnect()
        }

        return NextResponse.json({
            success: true,
            message: `Base de datos de "${tenant.name}" reiniciada a cero`,
            credentials: { username: 'admin', password: 'Admin123!', loginUrl: `/login/${tenant.slug}` }
        })
    } catch (error: any) {
        console.error('[RESET-DB]', error)
        return NextResponse.json(
            { error: 'Error al reiniciar la base de datos', details: error?.message || String(error) },
            { status: 500 }
        )
    }
}
