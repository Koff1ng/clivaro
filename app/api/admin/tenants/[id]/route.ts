import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-middleware'
import { prisma } from '@/lib/db'
import { logger } from '@/lib/logger'

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
          logger.warn(`[Admin Tenant Detail] Límite de conexiones alcanzado, reintentando en ${backoffDelay}ms (intento ${attempt + 1}/${maxRetries})`)
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

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth(request)

    if (session instanceof NextResponse) {
      return session
    }


    const user = session.user as any
    const { id } = await params

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

    const tenant = await executeWithRetry(() => prisma.tenant.findUnique({
      where: { id },
      include: {
        subscriptions: {
          include: {
            plan: true
          },
          orderBy: {
            createdAt: 'desc'
          }
        }
      }
    }))

    if (!tenant) {
      return NextResponse.json(
        { error: 'Tenant no encontrado' },
        { status: 404 }
      )
    }

    return NextResponse.json(tenant)
  } catch (error: any) {
    console.error('Error fetching tenant:', error)
    return NextResponse.json(
      { error: error.message || 'Error al obtener tenant' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth(request)

    if (session instanceof NextResponse) {
      return session
    }


    const user = session.user as any
    const { id } = await params

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
    const { name, email, phone, address, active, databaseUrl } = body

    const tenant = await prisma.tenant.update({
      where: { id },
      data: {
        name,
        email,
        phone,
        address,
        active,
        databaseUrl
      },
      include: {
        subscriptions: {
          include: {
            plan: true
          }
        }
      }
    })

    return NextResponse.json(tenant)
  } catch (error: any) {
    console.error('Error updating tenant:', error)
    return NextResponse.json(
      { error: error.message || 'Error al actualizar tenant' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth(request)

    if (session instanceof NextResponse) {
      return session
    }


    const user = session.user as any
    const { id } = await params

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

    // Get tenant info before deleting
    const tenant = await prisma.tenant.findUnique({
      where: { id },
      select: { slug: true, databaseUrl: true }
    })

    if (!tenant) {
      return NextResponse.json(
        { error: 'Tenant no encontrado' },
        { status: 404 }
      )
    }

    // Delete the PostgreSQL schema if using Postgres
    const isPostgres = tenant.databaseUrl?.startsWith('postgresql://') || tenant.databaseUrl?.startsWith('postgres://')

    if (isPostgres && tenant.slug) {
      const schemaName = `tenant_${tenant.slug.toLowerCase().replace(/[^a-z0-9_]/g, '_')}`

      // Use DIRECT_DATABASE_URL for DDL operations
      const directUrl = process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL

      if (directUrl) {
        const { PrismaClient } = await import('@prisma/client')
        const adminPrisma = new PrismaClient({
          datasources: { db: { url: directUrl } },
        })

        try {
          console.log(`[DELETE TENANT] Eliminando schema: ${schemaName}`)
          await adminPrisma.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`)
          console.log(`[DELETE TENANT] ✓ Schema ${schemaName} eliminado`)
        } catch (schemaError: any) {
          console.error(`[DELETE TENANT] ⚠️ Error eliminando schema: ${schemaError?.message}`)
          // Continue with tenant deletion even if schema deletion fails
        } finally {
          await adminPrisma.$disconnect()
        }
      }
    }

    // Delete the tenant record from master database
    await prisma.tenant.delete({
      where: { id }
    })

    return NextResponse.json({ success: true, schemaDeleted: isPostgres })
  } catch (error: any) {
    console.error('Error deleting tenant:', error)
    return NextResponse.json(
      { error: error.message || 'Error al eliminar tenant' },
      { status: 500 }
    )
  }
}


