import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-middleware'
import { prisma } from '@/lib/db'
import { initializeTenantDatabase } from '@/lib/initialize-tenant'
import { logger } from '@/lib/logger'
import * as path from 'path'
import { prisma as masterPrisma } from '@/lib/db'

// Función helper para ejecutar consultas con retry y manejo de errores de conexión
async function executeWithRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  delay = 1000
): Promise<T> {
  let lastError: any
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error: any) {
      lastError = error
      const errorMessage = error?.message || String(error)

      // Si es error de límite de conexiones, esperar y reintentar
      if (errorMessage.includes('MaxClientsInSessionMode') || errorMessage.includes('max clients reached')) {
        if (attempt < maxRetries - 1) {
          const backoffDelay = Math.min(delay * Math.pow(2, attempt), 10000) // Backoff exponencial, max 10s
          logger.warn(`[Admin Tenants] Límite de conexiones alcanzado, reintentando en ${backoffDelay}ms (intento ${attempt + 1}/${maxRetries})`)
          await new Promise(resolve => setTimeout(resolve, backoffDelay))
          continue
        }
      }

      // Si no es error de conexión, lanzar inmediatamente
      throw error
    }
  }
  throw lastError
}

export async function GET(request: Request) {
  try {
    const session = await requireAuth(request)

    if (session instanceof NextResponse) {
      return session
    }

    const user = session.user as any

    // Verificar si es super admin
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { isSuperAdmin: true }
    })

    if (!dbUser?.isSuperAdmin) {
      return NextResponse.json(
        { error: 'Unauthorized - Super admin access required' },
        { status: 403 }
      )
    }

    const tenants = await prisma.tenant.findMany({
      include: {
        subscriptions: {
          include: {
            plan: true
          },
          orderBy: {
            createdAt: 'desc'
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    return NextResponse.json(tenants)
  } catch (error: any) {
    logger.error('Error fetching tenants', error, { endpoint: '/api/admin/tenants', method: 'GET' })
    return NextResponse.json(
      { error: error.message || 'Error al obtener tenants' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireAuth(request)

    if (session instanceof NextResponse) {
      return session
    }

    const user = session.user as any

    // Verificar si es super admin
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { isSuperAdmin: true }
    })

    if (!dbUser?.isSuperAdmin) {
      return NextResponse.json(
        { error: 'Unauthorized - Super admin access required' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { name, slug, email, phone, address, databaseUrl } = body

    // Validar campos requeridos
    if (!name || !slug) {
      return NextResponse.json(
        { error: 'Nombre y slug son requeridos' },
        { status: 400 }
      )
    }

    // Validar formato del slug
    if (!/^[a-z0-9-]+$/.test(slug)) {
      return NextResponse.json(
        { error: 'El slug solo puede contener letras minúsculas, números y guiones' },
        { status: 400 }
      )
    }

    // Validar que el slug sea único
    const existingTenant = await executeWithRetry(() => prisma.tenant.findUnique({
      where: { slug }
    }))

    if (existingTenant) {
      return NextResponse.json(
        { error: 'El slug ya está en uso' },
        { status: 400 }
      )
    }

    const isPostgresEnv =
      (process.env.DATABASE_URL || '').startsWith('postgresql://') ||
      (process.env.DATABASE_URL || '').startsWith('postgres://')

    const toSchemaName = (value: string) => `tenant_${value.toLowerCase().replace(/[^a-z0-9_]/g, '_')}`
    const withSchemaParam = (value: string, schema: string) => {
      try {
        const url = new URL(value)
        url.searchParams.set('schema', schema)
        return url.toString()
      } catch {
        const separator = value.includes('?') ? '&' : '?'
        return `${value}${separator}schema=${encodeURIComponent(schema)}`
      }
    }

    // Generar ruta automática si no se proporciona
    // Usar separadores de ruta correctos para el sistema operativo
    let finalDatabaseUrl = databaseUrl
    if (isPostgresEnv) {
      const baseUrl = process.env.DATABASE_URL
      if (!baseUrl) {
        return NextResponse.json(
          { error: 'DATABASE_URL no está configurada para Postgres' },
          { status: 500 }
        )
      }
      finalDatabaseUrl = withSchemaParam(baseUrl, toSchemaName(slug))
    } else if (!finalDatabaseUrl || finalDatabaseUrl.trim() === '') {
      const defaultPath = path.join('tenants', `${slug}.db`)
      // Normalizar para usar / en lugar de \ para compatibilidad
      finalDatabaseUrl = `file:./${defaultPath.replace(/\\/g, '/')}`
    }

    // Crear el tenant
    let tenant
    try {
      tenant = await prisma.tenant.create({
        data: {
          name,
          slug,
          email: email || null,
          phone: phone || null,
          address: address || null,
          databaseUrl: finalDatabaseUrl
        },
        include: {
          subscriptions: {
            include: {
              plan: true
            }
          }
        }
      })
      logger.info('Tenant created', { tenantId: tenant.id })
    } catch (createError: any) {
      logger.error('Error creating tenant', createError, { endpoint: '/api/admin/tenants', method: 'POST' })
      return NextResponse.json(
        {
          error: 'Error al crear el tenant',
          details: createError.message || 'Error desconocido'
        },
        { status: 500 }
      )
    }

    // Inicializar la base de datos del tenant (permisos, roles, usuario admin, almacén)
    try {
      logger.info('Initializing tenant database', { tenantId: tenant.id })
      const { adminUsername, adminPassword } = await initializeTenantDatabase(
        finalDatabaseUrl,
        name,
        slug,
        tenant.id // Pass the ID for standardized schema naming
      )
      logger.info('Tenant database initialized', { tenantId: tenant.id })

      // Ensure default plans exist and assign a default Starter subscription if none
      const plansCount = await masterPrisma.plan.count()
      if (plansCount === 0) {
        await masterPrisma.plan.createMany({
          data: [
            {
              name: 'Starter',
              description: 'Perfecto para pequeños negocios que están comenzando',
              price: 49900,
              currency: 'COP',
              interval: 'monthly',
              features: JSON.stringify([
                'Hasta 2 usuarios incluidos',
                'Gestión de productos ilimitados',
                'Punto de Venta (POS)',
                'Control de inventario básico',
                'Facturación electrónica',
                'Clientes y proveedores',
                'Reportes básicos',
                'Dashboard con KPIs',
              ]),
              active: true,
            },
            {
              name: 'Business',
              description: 'Ideal para negocios en crecimiento',
              price: 79900,
              currency: 'COP',
              interval: 'monthly',
              features: JSON.stringify(['Todas las funcionalidades de Starter', 'CRM completo', 'Marketing campaigns', 'Multi-almacén']),
              active: true,
            },
            {
              name: 'Enterprise',
              description: 'Para negocios grandes que necesitan todo',
              price: 149900,
              currency: 'COP',
              interval: 'monthly',
              features: JSON.stringify(['Todas las funcionalidades de Business', 'Soporte 24/7', 'Integraciones avanzadas']),
              active: true,
            },
          ],
        })
      }

      const starter = await masterPrisma.plan.findUnique({ where: { name: 'Starter' } })
      if (starter) {
        await masterPrisma.subscription.create({
          data: {
            tenantId: tenant.id,
            planId: starter.id,
            status: 'active',
            startDate: new Date(),
            autoRenew: true,
          },
        })
      }

      return NextResponse.json(
        {
          ...tenant,
          _initialCredentials: {
            username: adminUsername,
            password: adminPassword,
            message: 'Guarde estas credenciales. El usuario debe cambiar la contraseña después del primer inicio de sesión.'
          }
        },
        { status: 201 }
      )
    } catch (initError: any) {
      // Si falla la inicialización, eliminar el tenant creado
      try {
        await prisma.tenant.delete({
          where: { id: tenant.id }
        })
        logger.warn('Tenant deleted after initialization failure', { tenantId: tenant.id })
      } catch (deleteError) {
        logger.error('Error deleting tenant after init failure', deleteError, { tenantId: tenant.id })
      }

      const errorMessage = initError.message || initError.toString() || 'Error desconocido'
      logger.error('Error initializing tenant database', initError, { tenantId: tenant.id, errorMessage })

      return NextResponse.json(
        {
          error: 'Error al inicializar la base de datos del tenant',
          details: errorMessage,
          suggestion: 'Verifique la configuración de DATABASE_URL o la ruta de la base de datos.'
        },
        { status: 500 }
      )
    }
  } catch (error: any) {
    logger.error('Error creating tenant', error, { endpoint: '/api/admin/tenants', method: 'POST' })
    return NextResponse.json(
      { error: error.message || 'Error al crear tenant' },
      { status: 500 }
    )
  }
}

