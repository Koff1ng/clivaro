import { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import { prisma } from './db'
import { getTenantPrisma } from './tenant-db'
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
        console.log('[AUTH] authorize llamado con:', {
          username: credentials?.username,
          hasPassword: !!credentials?.password,
          tenantSlug: credentials?.tenantSlug,
          allKeys: Object.keys(credentials || {})
        })

        if (!credentials?.username || !credentials?.password) {
          console.log('[AUTH] Credenciales incompletas')
          return null
        }

        // Si es super admin, usar la BD maestra
        // Si tiene tenantSlug, usar la BD del tenant
        let tenantPrisma = prisma
        let tenantId: string | null = null

        if (credentials.tenantSlug) {
          console.log(`[AUTH] Buscando tenant con slug: ${credentials.tenantSlug}`)
          // Obtener tenant de la BD maestra
          const tenant = await prisma.tenant.findUnique({
            where: { slug: credentials.tenantSlug },
            select: {
              id: true,
              databaseUrl: true,
              active: true,
            }
          })

          if (!tenant || !tenant.active) {
            console.log(`[AUTH] Tenant no encontrado o inactivo: ${credentials.tenantSlug}`)
            return null
          }

          console.log(`[AUTH] Tenant encontrado: ${tenant.id}, Database URL: ${tenant.databaseUrl}`)
          tenantId = tenant.id
          // Obtener cliente Prisma del tenant
          tenantPrisma = getTenantPrisma(tenant.databaseUrl)
          console.log(`[AUTH] Usando BD del tenant`)
        } else {
          console.log(`[AUTH] No hay tenantSlug, usando BD maestra`)
        }

        // Try to find user by username first, then by email
        console.log(`[AUTH] Buscando usuario: ${credentials.username}`)
        const user = await tenantPrisma.user.findFirst({
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

        if (!user) {
          console.log(`[AUTH] Usuario no encontrado: ${credentials.username}`)
          return null
        }

        if (!user.active) {
          console.log(`[AUTH] Usuario inactivo: ${credentials.username}`)
          return null
        }

        console.log(`[AUTH] Usuario encontrado: ${user.username}, verificando contraseña...`)
        const isValid = await bcrypt.compare(credentials.password, user.password)

        if (!isValid) {
          console.log(`[AUTH] Contraseña inválida para usuario: ${credentials.username}`)
          return null
        }

        console.log(`[AUTH] Autenticación exitosa para: ${user.username}`)

        // Extract permissions
        const permissions = new Set<string>()
        user.userRoles.forEach(userRole => {
          userRole.role.rolePermissions.forEach(rp => {
            permissions.add(rp.permission.name)
          })
        })

        return {
          id: user.id,
          email: user.email || '',
          username: user.username,
          name: user.name,
          permissions: Array.from(permissions),
          roles: user.userRoles.map(ur => ur.role.name),
          isSuperAdmin: user.isSuperAdmin || false,
          tenantId: tenantId || undefined
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
        ;(session.user as any).permissions = token.permissions || []
        ;(session.user as any).roles = token.roles || []
        ;(session.user as any).isSuperAdmin = token.isSuperAdmin || false
        ;(session.user as any).tenantId = token.tenantId || null
      }
      return session
    }
  },
  pages: {
    signIn: '/login'
  },
  secret: process.env.NEXTAUTH_SECRET
}

