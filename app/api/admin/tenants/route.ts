import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-middleware'
import { prisma } from '@/lib/db'
import { initializeTenantDatabase } from '@/lib/initialize-tenant'
import { logger } from '@/lib/logger'
import * as path from 'path'

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
    const existingTenant = await prisma.tenant.findUnique({
      where: { slug }
    })

    if (existingTenant) {
      return NextResponse.json(
        { error: 'El slug ya está en uso' },
        { status: 400 }
      )
    }

    // Generar ruta automática si no se proporciona
    // Usar separadores de ruta correctos para el sistema operativo
    let finalDatabaseUrl = databaseUrl
    if (!finalDatabaseUrl || finalDatabaseUrl.trim() === '') {
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
        name
      )
      logger.info('Tenant database initialized', { tenantId: tenant.id })

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
          suggestion: 'Verifique que la ruta de la base de datos sea válida y que tenga permisos de escritura.'
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

