import { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import { PrismaClient } from '@prisma/client'
import { prisma } from './db'
import { getSchemaName, withTenantSchemaUrl } from './tenant-utils'
import bcrypt from 'bcryptjs'

// ─── Tenant Prisma Client Cache ───────────────────────────────────────────────
// We cache one PrismaClient per tenant schema URL to avoid recreating on every
// login, but each client is fully isolated (separate connection pool, schema param).
const tenantClientCache = new Map<string, PrismaClient>()

function getTenantPrismaClient(tenantId: string): PrismaClient {
  const schemaName = getSchemaName(tenantId)
  // Use DIRECT_URL to bypass PgBouncer for auth queries (avoids SET LOCAL issues)
  const baseUrl = process.env.DIRECT_URL || process.env.DATABASE_URL || ''
  const schemaUrl = withTenantSchemaUrl(baseUrl, tenantId)

  if (!tenantClientCache.has(schemaName)) {
    console.log(`[AUTH] Creating isolated PrismaClient for schema: ${schemaName}`)
    const client = new PrismaClient({
      datasources: { db: { url: schemaUrl } },
      log: [],
    })
    tenantClientCache.set(schemaName, client)
  }

  return tenantClientCache.get(schemaName)!
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
        try {
          if (!credentials?.username || !credentials?.password) {
            return null
          }

          // ── STRATEGY A: Tenant Login ────────────────────────────────────────
          if (credentials.tenantSlug) {
            console.log(`[AUTH] Tenant login attempt for slug: "${credentials.tenantSlug}"`)

            // 1. Resolve tenant from master DB
            const tenant = await prisma.tenant.findUnique({
              where: { slug: credentials.tenantSlug },
              select: { id: true, active: true, slug: true },
            })

            if (!tenant) {
              console.warn(`[AUTH] Tenant not found for slug: "${credentials.tenantSlug}"`)
              throw new Error('INVALID_CREDENTIALS: Empresa no encontrada.')
            }

            if (!tenant.active) {
              console.warn(`[AUTH] Tenant inactive: "${credentials.tenantSlug}"`)
              throw new Error('TENANT_NOT_READY: Esta empresa no está activa.')
            }

            console.log(`[AUTH] Resolved tenant ${tenant.slug} → id: ${tenant.id}, schema: ${getSchemaName(tenant.id)}`)

            // 2. Use DEDICATED PrismaClient for this tenant schema
            // This avoids any connection pool search_path contamination
            const tenantPrisma = getTenantPrismaClient(tenant.id)

            let tenantUser: any = null
            try {
              tenantUser = await tenantPrisma.user.findFirst({
                where: {
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
                          rolePermissions: {
                            include: { permission: true },
                          },
                        },
                      },
                    },
                  },
                },
              })
            } catch (dbError: any) {
              console.error(`[AUTH] DB error querying tenant schema for ${tenant.slug}:`, dbError?.message)
              throw new Error('TENANT_DB_ERROR: No se pudo conectar con la base de datos de la empresa.')
            }

            if (!tenantUser) {
              console.warn(`[AUTH] User "${credentials.username}" not found in tenant "${tenant.slug}"`)
              throw new Error('INVALID_CREDENTIALS: Usuario o contraseña incorrectos.')
            }

            if (!tenantUser.active) {
              throw new Error('USER_INACTIVE: Usuario inactivo.')
            }

            const isValid = await bcrypt.compare(credentials.password, tenantUser.password)
            if (!isValid) {
              console.warn(`[AUTH] Invalid password for user "${credentials.username}" in tenant "${tenant.slug}"`)
              throw new Error('INVALID_CREDENTIALS: Usuario o contraseña incorrectos.')
            }

            // Extract permissions and roles from the tenant user's roles
            const permissions = new Set<string>()
            const roles: string[] = []
            tenantUser.userRoles.forEach((ur: any) => {
              roles.push(ur.role.name)
              ur.role.rolePermissions.forEach((rp: any) => {
                permissions.add(rp.permission.name)
              })
            })

            console.log(`[AUTH] ✓ Tenant login success: ${tenantUser.username} @ ${tenant.slug} | roles: [${roles.join(', ')}] | perms: ${permissions.size}`)

            return {
              id: tenantUser.id,
              email: tenantUser.email || '',
              name: tenantUser.name,
              username: tenantUser.username,
              permissions: Array.from(permissions),
              roles,
              isSuperAdmin: false, // CRITICAL: tenant users are NEVER super admins
              tenantId: tenant.id,
              tenantSlug: tenant.slug,
            }
          }

          // ── STRATEGY B: Super Admin Login (master DB ONLY) ─────────────────
          console.log(`[AUTH] Super admin login attempt for: "${credentials.username}"`)

          // SECURITY: Filter by isSuperAdmin=true to prevent tenant user crossover
          // even if connection pool leaks search_path to a tenant schema
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
                      rolePermissions: {
                        include: { permission: true },
                      },
                    },
                  },
                },
              },
            },
          })

          // Double-check: extra guard even if Prisma returns something unexpected
          if (!superAdmin || !superAdmin.isSuperAdmin) {
            console.warn(`[AUTH] Super admin not found or not a super admin: "${credentials.username}"`)
            return null
          }

          if (!superAdmin.active) {
            throw new Error('USER_INACTIVE: Usuario inactivo.')
          }

          const isValid = await bcrypt.compare(credentials.password, superAdmin.password)
          if (!isValid) {
            console.warn(`[AUTH] Invalid password for super admin: "${credentials.username}"`)
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

          console.log(`[AUTH] ✓ Super admin login success: ${superAdmin.username}`)

          return {
            id: superAdmin.id,
            email: superAdmin.email || '',
            name: superAdmin.name,
            username: superAdmin.username,
            permissions: Array.from(permissions),
            roles,
            isSuperAdmin: true,
            tenantId: null,
            tenantSlug: null,
          }

        } catch (error: any) {
          // Re-throw structured errors, but hide internals for security
          const msg = error?.message || ''
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
        // Embed all user data into the JWT on first sign-in
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
        (session.user as any).id = token.sub || token.id || ''
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

  pages: {
    signIn: '/login',
  },

  secret: process.env.NEXTAUTH_SECRET,
}
