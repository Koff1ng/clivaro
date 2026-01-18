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
        try {
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

            const envUrl = process.env.DATABASE_URL || ''
            const isPostgresEnv = envUrl.startsWith('postgresql://') || envUrl.startsWith('postgres://')
            if (isPostgresEnv && tenant.databaseUrl?.startsWith('file:')) {
              console.log('[AUTH] Tenant usa SQLite en producción (no soportado). Debe migrarse:', {
                tenantId: tenant.id,
                slug: credentials.tenantSlug,
              })
              throw new Error('TENANT_NOT_READY: Este tenant aún no está configurado en producción.')
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
          let user: any = null
          
          // Retry con backoff exponencial para manejar límites de conexión
          const maxRetries = 3
          let lastError: any = null
          
          for (let attempt = 0; attempt < maxRetries; attempt++) {
            try {
              user = await tenantPrisma.user.findFirst({
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
              break // Éxito, salir del loop
            } catch (dbError: any) {
              lastError = dbError
              const errorMessage = dbError?.message || String(dbError)
              
              // Si es error de límite de conexiones, esperar y reintentar
              if (errorMessage.includes('MaxClientsInSessionMode') || errorMessage.includes('max clients reached')) {
                if (attempt < maxRetries - 1) {
                  // Aumentar el delay para dar tiempo a que se liberen las conexiones
                  const delay = Math.min(2000 * Math.pow(2, attempt), 10000) // Backoff exponencial, max 10s
                  console.warn(`[AUTH] Límite de conexiones alcanzado, reintentando en ${delay}ms (intento ${attempt + 1}/${maxRetries})`)
                  await new Promise(resolve => setTimeout(resolve, delay))
                  continue
                } else {
                  // En el último intento, dar un mensaje más claro
                  throw new Error('TENANT_DB_ERROR: El sistema está experimentando una alta carga. Por favor, intente nuevamente en unos momentos.')
                }
              }
              
              // Otros errores o último intento fallido
              console.error('[AUTH] Error consultando BD del tenant:', errorMessage)
              throw new Error(`TENANT_DB_ERROR: ${errorMessage}`)
            }
          }
          
          if (!user && lastError) {
            throw new Error(`TENANT_DB_ERROR: ${lastError?.message || 'No se pudo consultar la BD del tenant'}`)
          }

          if (!user) {
            console.log(`[AUTH] Usuario no encontrado: ${credentials.username}`)
            // Provide an actionable message for tenant logins
            if (credentials.tenantSlug) {
              throw new Error('INVALID_CREDENTIALS: Usuario o contraseña incorrectos para esta empresa.')
            }
            return null
          }

          if (!user.active) {
            console.log(`[AUTH] Usuario inactivo: ${credentials.username}`)
            throw new Error('USER_INACTIVE: Usuario inactivo.')
          }

          console.log(`[AUTH] Usuario encontrado: ${user.username}, verificando contraseña...`)
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
          // NextAuth will surface this string in result.error when redirect: false
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

