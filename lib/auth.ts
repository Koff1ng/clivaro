import { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import { prisma } from './db'
import { withTenantTx } from './tenancy'
import bcrypt from 'bcryptjs'

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        username: { label: 'Usuario', type: 'text' },
        password: { label: 'Password', type: 'password' },
        tenantSlug: { label: 'Tenant Slug', type: 'text' }
      },
      async authorize(credentials) {
        try {
          console.log('[AUTH] authorize llamado con:', {
            username: credentials?.username,
            hasPassword: !!credentials?.password,
            tenantSlug: credentials?.tenantSlug,
          })

          if (!credentials?.username || !credentials?.password) {
            return null
          }

          let user: any = null
          let tenantId: string | undefined = undefined

          if (credentials.tenantSlug) {
            // 1. Tenant Login Strategy
            console.log(`[AUTH] Buscando tenant con slug: ${credentials.tenantSlug}`)
            const tenant = await prisma.tenant.findUnique({
              where: { slug: credentials.tenantSlug },
              select: { id: true, active: true }
            })

            if (!tenant || !tenant.active) {
              console.log(`[AUTH] Tenant no encontrado o inactivo: ${credentials.tenantSlug}`)
              return null
            }

            tenantId = tenant.id
            console.log(`[AUTH] Tenant encontrado: ${tenant.id}. Ejecutando consulta en contexto de tenant.`)

            try {
              user = await withTenantTx(tenant.id, async (tx: any) => {
                return tx.user.findFirst({
                  where: {
                    OR: [
                      { username: credentials.username },
                      { email: credentials.username }
                    ]
                  },
                  include: {
                    userRoles: {
                      include: {
                        role: {
                          include: {
                            rolePermissions: {
                              include: {
                                permission: true
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                })
              })
            } catch (e: any) {
              console.error(`[AUTH] Error switching to tenant schema ${tenant.id}: ${e.message}`)
              throw new Error('TENANT_DB_ERROR: No se pudo establecer conexión con la base de datos de la empresa.')
            }

            // If we are in a tenant context, we MUST find the user in that tenant.
            if (!user) {
              console.log(`[AUTH] Usuario no encontrado en tenant schema: ${credentials.username}. Acceso denegado.`)
              throw new Error('INVALID_CREDENTIALS: El usuario no existe en esta empresa.')
            }

          } else {
            // 2. Global/SuperAdmin Login Strategy (Public Schema)
            console.log(`[AUTH] No hay tenantSlug, usando BD maestra`)
            user = await prisma.user.findFirst({
              where: {
                OR: [
                  { username: credentials.username },
                  { email: credentials.username }
                ]
              },
              include: {
                userRoles: {
                  include: {
                    role: {
                      include: {
                        rolePermissions: {
                          include: {
                            permission: true
                          }
                        }
                      }
                    }
                  }
                }
              }
            })
          }

          if (!user) {
            console.log(`[AUTH] Usuario no encontrado: ${credentials.username}`)
            if (credentials.tenantSlug) {
              throw new Error('INVALID_CREDENTIALS: Usuario o contraseña incorrectos para esta empresa.')
            }
            return null
          }

          if (!user.active) {
            throw new Error('USER_INACTIVE: Usuario inactivo.')
          }

          const isValid = await bcrypt.compare(credentials.password, user.password)

          if (!isValid) {
            console.log(`[AUTH] Contraseña inválida para usuario: ${credentials.username}`)
            if (credentials.tenantSlug) {
              throw new Error('INVALID_CREDENTIALS: Usuario o contraseña incorrectos para esta empresa.')
            }
            return null
          }

          console.log(`[AUTH] Autenticación exitosa para: ${user.username}`)

          // Extract permissions
          const permissions = new Set<string>()
          user.userRoles.forEach((userRole: any) => {
            userRole.role.rolePermissions.forEach((rp: any) => {
              permissions.add(rp.permission.name)
            })
          })

          return {
            id: user.id,
            email: user.email || '',
            username: user.username,
            name: user.name,
            permissions: Array.from(permissions),
            roles: user.userRoles.map((ur: any) => ur.role.name),
            isSuperAdmin: user.isSuperAdmin || false,
            tenantId: tenantId || undefined
          }

        } catch (error: any) {
          console.error('[AUTH] authorize failed:', error?.message || error)
          throw error
        }
      }
    })
  ],
  session: {
    strategy: 'jwt'
  },
  callbacks: {
    async jwt({ token, user, trigger }) {
      // Initial sign in
      if (user) {
        token.sub = user.id
        token.id = user.id
        token.email = user.email
        token.name = user.name
        token.permissions = (user as any).permissions || []
        token.roles = (user as any).roles || []
        token.isSuperAdmin = (user as any).isSuperAdmin || false
        token.tenantId = (user as any).tenantId || null
      }
      // Ensure sub is always set (required for getToken)
      if (!token.sub && token.id) {
        token.sub = token.id as string
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.sub || token.id || ''
        session.user.email = token.email || session.user.email || ''
        session.user.name = token.name || session.user.name || ''
          ; (session.user as any).permissions = token.permissions || []
          ; (session.user as any).roles = token.roles || []
          ; (session.user as any).isSuperAdmin = token.isSuperAdmin || false
          ; (session.user as any).tenantId = token.tenantId || null
      }
      return session
    }
  },
  pages: {
    signIn: '/login'
  },
  secret: process.env.NEXTAUTH_SECRET
}

