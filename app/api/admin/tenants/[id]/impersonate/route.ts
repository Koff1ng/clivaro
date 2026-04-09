import { NextResponse } from 'next/server'
import { logger } from '@/lib/logger'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { Client } from 'pg'
import crypto from 'crypto'
import jwt from 'jsonwebtoken'

export const dynamic = 'force-dynamic'

/**
 * POST /api/admin/tenants/[id]/impersonate
 * Generate a temporary JWT for impersonating a tenant's admin user.
 * Only Super Admins can call this.
 * Token expires in 30 minutes and has an `impersonation: true` flag.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: tenantId } = await params
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const adminUser = await prisma.user.findUnique({
      where: { id: (session.user as any).id },
      select: { id: true, isSuperAdmin: true, name: true, email: true }
    })

    if (!adminUser?.isSuperAdmin) {
      return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 })
    }

    // Find the tenant
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, name: true, slug: true, active: true, databaseUrl: true }
    })

    if (!tenant) {
      return NextResponse.json({ error: 'Tenant no encontrado' }, { status: 404 })
    }

    // Find the admin user in the tenant's schema
    const connString = process.env.DIRECT_URL || process.env.DATABASE_URL || ''
    const cleanUrl = (() => {
      try {
        const url = new URL(connString)
        url.searchParams.delete('schema')
        url.searchParams.delete('pgbouncer')
        url.searchParams.delete('connect_timeout')
        return url.toString()
      } catch {
        return connString
      }
    })()

    const schemaName = `tenant_${tenant.slug}`
    const client = new Client({
      connectionString: cleanUrl,
      ssl: cleanUrl.includes('localhost') || cleanUrl.includes('127.0.0.1') ? false : { rejectUnauthorized: false }
    })

    let tenantAdmin: any = null

    try {
      await client.connect()
      await client.query(`SET search_path TO "${schemaName}", public`)

      // Find the first active admin user in the tenant
      const result = await client.query(`
        SELECT u.id, u.username, u.email, u.name, u.active
        FROM "User" u
        JOIN "UserRole" ur ON ur."userId" = u.id
        JOIN "Role" r ON r.id = ur."roleId"
        WHERE r.name = 'ADMIN' AND u.active = true
        ORDER BY u."createdAt" ASC
        LIMIT 1
      `)

      if (result.rows.length > 0) {
        tenantAdmin = result.rows[0]
      }

      // Get roles and permissions for the admin
      if (tenantAdmin) {
        const rolesResult = await client.query(`
          SELECT r.name as role_name, p.name as perm_name
          FROM "UserRole" ur
          JOIN "Role" r ON r.id = ur."roleId"
          LEFT JOIN "RolePermission" rp ON rp."roleId" = r.id
          LEFT JOIN "Permission" p ON p.id = rp."permissionId"
          WHERE ur."userId" = $1
        `, [tenantAdmin.id])

        tenantAdmin.roles = [...new Set(rolesResult.rows.map((r: any) => r.role_name).filter(Boolean))]
        tenantAdmin.permissions = [...new Set(rolesResult.rows.map((r: any) => r.perm_name).filter(Boolean))]
      }
    } finally {
      await client.end().catch(() => {})
    }

    if (!tenantAdmin) {
      return NextResponse.json(
        { error: 'No se encontró un usuario admin activo en este tenant' },
        { status: 404 }
      )
    }

    // Generate impersonation JWT (30 min expiry)
    const secret = process.env.NEXTAUTH_SECRET || 'fallback-secret'
    const impersonationToken = jwt.sign(
      {
        impersonation: true,
        superAdminId: adminUser.id,
        superAdminName: adminUser.name,
        tenantUserId: tenantAdmin.id,
        tenantId: tenant.id,
        tenantSlug: tenant.slug,
        tenantName: tenant.name,
        userName: tenantAdmin.name,
        userEmail: tenantAdmin.email || '',
        permissions: tenantAdmin.permissions,
        roles: tenantAdmin.roles,
        iat: Math.floor(Date.now() / 1000),
      },
      secret,
      { expiresIn: '30m' }
    )

    // Log the impersonation action
    logger.info(`[IMPERSONATION] Super Admin "${adminUser.name}" (${adminUser.id}) impersonating tenant "${tenant.name}" (${tenant.slug}) as user "${tenantAdmin.name}" (${tenantAdmin.id})`)

    // Store audit log in DB
    try {
      await prisma.$executeRawUnsafe(`
        INSERT INTO "AdminAuditLog" (id, action, "adminUserId", "adminUserName", "targetTenantId", "targetTenantName", details, "ipAddress", "createdAt")
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
      `,
        crypto.randomUUID(),
        'IMPERSONATE_TENANT',
        adminUser.id,
        adminUser.name || '',
        tenant.id,
        tenant.name,
        JSON.stringify({ tenantUser: tenantAdmin.name, tenantUserId: tenantAdmin.id }),
        request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'
      )
    } catch (auditError) {
      // Don't block impersonation if audit table doesn't exist yet
      logger.warn('[IMPERSONATION] Could not write audit log:', auditError)
    }

    return NextResponse.json({
      token: impersonationToken,
      tenant: { id: tenant.id, name: tenant.name, slug: tenant.slug },
      user: { id: tenantAdmin.id, name: tenantAdmin.name, email: tenantAdmin.email },
      expiresIn: '30 minutos',
    })

  } catch (error: any) {
    logger.error('[IMPERSONATION] Error:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
