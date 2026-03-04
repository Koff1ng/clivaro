import { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import { Client } from 'pg'
import { prisma } from './db'
import { getSchemaName } from './tenant-utils'
import bcrypt from 'bcryptjs'

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Returns a clean database URL without any schema or pgbouncer params,
 * suitable for a direct pg Client connection.
 */
function getDirectPostgresUrl(): string {
  // Prefer DIRECT_URL (bypasses PgBouncer) for schema-aware queries
  const base = process.env.DIRECT_URL || process.env.DATABASE_URL || ''
  try {
    const url = new URL(base)
    // Remove params that confuse pg Client or PgBouncer
    url.searchParams.delete('schema')
    url.searchParams.delete('pgbouncer')
    url.searchParams.delete('connect_timeout')
    return url.toString()
  } catch {
    return base
  }
}

/**
 * Finds a user by username/email within a specific tenant schema.
 * Uses a raw pg Client so we can SET search_path for the entire session
 * without relying on Prisma's ?schema=xxx parameter (which may not work
 * correctly with PgBouncer in transaction mode).
 */
async function findUserInTenantSchema(
  tenantId: string,
  usernameOrEmail: string
): Promise<any | null> {
  const schemaName = getSchemaName(tenantId)
  const connString = getDirectPostgresUrl()

  const client = new Client({ connectionString: connString })

  try {
    await client.connect()

    // Set the schema for this entire session/connection
    await client.query(`SET search_path TO "${schemaName}", public`)

    // Query the user with their roles and permissions
    const userResult = await client.query(
      `SELECT id, username, email, name, password, active, "isSuperAdmin"
       FROM "User"
       WHERE (username = $1 OR email = $1)
       LIMIT 1`,
      [usernameOrEmail]
    )

    if (userResult.rows.length === 0) return null

    const user = userResult.rows[0]

    // Query roles and permissions for this user
    const rolesResult = await client.query(
      `SELECT r.name as role_name, p.name as perm_name
       FROM "UserRole" ur
       JOIN "Role" r ON r.id = ur."roleId"
       LEFT JOIN "RolePermission" rp ON rp."roleId" = r.id
       LEFT JOIN "Permission" p ON p.id = rp."permissionId"
       WHERE ur."userId" = $1`,
      [user.id]
    )

    const roles = [...new Set(rolesResult.rows.map((r: any) => r.role_name).filter(Boolean))]
    const permissions = [...new Set(rolesResult.rows.map((r: any) => r.perm_name).filter(Boolean))]

    return { ...user, roles, permissions }

  } finally {
    await client.end().catch(() => {/* ignore close errors */ })
  }
}

// ─── NextAuth Config ──────────────────────────────────────────────────────────

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        username: { label: 'Usuario', type: 'text' },
        password: { label: 'Password', type: 'password' },
        tenantSlug: { label: 'Tenant Slug', type: 'text' },
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) {
          return null
        }

        try {
          // ── STRATEGY A: Tenant Login ──────────────────────────────────────
          if (credentials.tenantSlug) {
            console.log(`[AUTH] Tenant login: slug="${credentials.tenantSlug}" user="${credentials.username}"`)

            // Step 1: Resolve tenant from master DB (public schema)
            const tenant = await prisma.tenant.findUnique({
              where: { slug: credentials.tenantSlug },
              select: { id: true, active: true, slug: true },
            })

            if (!tenant) {
              console.warn(`[AUTH] Tenant not found for slug: "${credentials.tenantSlug}"`)
              throw new Error('INVALID_CREDENTIALS: Empresa no encontrada.')
            }
            if (!tenant.active) {
              throw new Error('TENANT_NOT_READY: Esta empresa no está activa.')
            }

            const schemaName = getSchemaName(tenant.id)
            console.log(`[AUTH] Resolved: ${tenant.slug} → id=${tenant.id} schema=${schemaName}`)

            // Step 2: Find user in tenant's schema using raw pg Client
            // This is 100% isolated — no shared connection pool, no contamination
            let tenantUser: any
            try {
              tenantUser = await findUserInTenantSchema(tenant.id, credentials.username)
            } catch (dbError: any) {
              console.error(`[AUTH] DB error for tenant schema "${schemaName}":`, dbError?.message)
              throw new Error('TENANT_DB_ERROR: No se pudo conectar con la base de datos de la empresa.')
            }

            if (!tenantUser) {
              console.warn(`[AUTH] User "${credentials.username}" not found in schema "${schemaName}"`)
              throw new Error('INVALID_CREDENTIALS: Usuario o contraseña incorrectos.')
            }
            if (!tenantUser.active) {
              throw new Error('USER_INACTIVE: Usuario inactivo.')
            }

            const isValid = await bcrypt.compare(credentials.password, tenantUser.password)
            if (!isValid) {
              console.warn(`[AUTH] Wrong password for "${credentials.username}" in schema "${schemaName}"`)
              throw new Error('INVALID_CREDENTIALS: Usuario o contraseña incorrectos.')
            }

            console.log(`[AUTH] ✓ Tenant auth success: ${tenantUser.username} @ ${tenant.slug} | roles=[${tenantUser.roles.join(', ')}] | perms=${tenantUser.permissions.length}`)

            return {
              id: tenantUser.id,
              email: tenantUser.email || '',
              name: tenantUser.name,
              permissions: tenantUser.permissions,
              roles: tenantUser.roles,
              isSuperAdmin: false, // tenant users are NEVER super admins
              tenantId: tenant.id,
              tenantSlug: tenant.slug,
            }
          }

          // ── STRATEGY B: Super Admin Login (master public schema ONLY) ─────
          console.log(`[AUTH] Super admin login: user="${credentials.username}"`)

          const superAdmin = await prisma.user.findFirst({
            where: {
              isSuperAdmin: true,
              OR: [
                { username: credentials.username },
                { email: credentials.username },
              ],
            },
            include: {
              userRoles: {
                include: {
                  role: {
                    include: {
                      rolePermissions: { include: { permission: true } },
                    },
                  },
                },
              },
            },
          })

          if (!superAdmin || !superAdmin.isSuperAdmin) {
            console.warn(`[AUTH] Super admin not found: "${credentials.username}"`)
            return null
          }
          if (!superAdmin.active) {
            throw new Error('USER_INACTIVE: Usuario inactivo.')
          }

          const isValid = await bcrypt.compare(credentials.password, superAdmin.password)
          if (!isValid) {
            console.warn(`[AUTH] Wrong password for super admin: "${credentials.username}"`)
            return null
          }

          const permissions = new Set<string>()
          const roles: string[] = []
          superAdmin.userRoles.forEach((ur: any) => {
            roles.push(ur.role.name)
            ur.role.rolePermissions.forEach((rp: any) => {
              permissions.add(rp.permission.name)
            })
          })

          console.log(`[AUTH] ✓ Super admin auth success: ${superAdmin.username}`)

          return {
            id: superAdmin.id,
            email: superAdmin.email || '',
            name: superAdmin.name,
            permissions: Array.from(permissions),
            roles,
            isSuperAdmin: true,
            tenantId: null,
            tenantSlug: null,
          }

        } catch (error: any) {
          const msg = error?.message || ''
          // Only re-throw known structured errors; hide unexpected ones
          if (
            msg.startsWith('INVALID_CREDENTIALS:') ||
            msg.startsWith('USER_INACTIVE:') ||
            msg.startsWith('TENANT_DB_ERROR:') ||
            msg.startsWith('TENANT_NOT_READY:')
          ) {
            throw error
          }
          console.error('[AUTH] Unexpected auth error:', msg)
          throw new Error('TENANT_DB_ERROR: Error interno de autenticación.')
        }
      },
    }),
  ],

  session: { strategy: 'jwt' },

  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.sub = user.id
        token.id = user.id
        token.email = user.email
        token.name = user.name
        token.permissions = (user as any).permissions || []
        token.roles = (user as any).roles || []
        token.isSuperAdmin = (user as any).isSuperAdmin ?? false
        token.tenantId = (user as any).tenantId ?? null
        token.tenantSlug = (user as any).tenantSlug ?? null
      }
      if (!token.sub && token.id) {
        token.sub = token.id as string
      }
      return token
    },

    async session({ session, token }) {
      if (session.user) {
        ; (session.user as any).id = token.sub || token.id || ''
        session.user.email = token.email || ''
        session.user.name = token.name || ''
          ; (session.user as any).permissions = token.permissions || []
          ; (session.user as any).roles = token.roles || []
          ; (session.user as any).isSuperAdmin = token.isSuperAdmin ?? false
          ; (session.user as any).tenantId = token.tenantId ?? null
          ; (session.user as any).tenantSlug = token.tenantSlug ?? null
      }
      return session
    },
  },

  pages: { signIn: '/login' },
  secret: process.env.NEXTAUTH_SECRET,
}
