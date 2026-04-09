import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-middleware'
import { prisma } from '@/lib/db'
import { logger } from '@/lib/logger'
import { getSchemaName } from '@/lib/tenant-utils'

export const dynamic = 'force-dynamic'

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
    logger.error('Error fetching tenant:', error)
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
    logger.error('Error updating tenant:', error)
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
      select: { isSuperAdmin: true, name: true }
    })

    if (!dbUser?.isSuperAdmin) {
      return NextResponse.json(
        { error: 'Unauthorized - Super admin access required' },
        { status: 403 }
      )
    }

    // Get tenant info
    // Check if force=true for hard delete, otherwise soft-delete
    const tenant = await prisma.tenant.findUnique({
      where: { id },
      select: { id: true, name: true, slug: true, databaseUrl: true, active: true }
    })

    if (!tenant) {
      return NextResponse.json(
        { error: 'Tenant no encontrado' },
        { status: 404 }
      )
    }

    // Delete the PostgreSQL schema if using Postgres
    const url = new URL(request.url)
    const forceDelete = url.searchParams.get('force') === 'true'

    // SOFT DELETE by default — just deactivate the tenant
    if (!forceDelete) {
      await prisma.tenant.update({ where: { id }, data: { active: false } })
      try {
        await (prisma as any).adminAuditLog.create({
          data: {
            action: 'SOFT_DELETE_TENANT',
            adminUserId: user.id,
            adminUserName: dbUser?.name || user.name || '',
            targetTenantId: tenant.id,
            targetTenantName: tenant.name,
            details: JSON.stringify({ slug: tenant.slug }),
            ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
          }
        })
      } catch { /* audit table may not exist */ }
      logger.info(`[DELETE TENANT] Soft-deleted "${tenant.name}" (${tenant.slug})`)
      return NextResponse.json({
        success: true,
        softDelete: true,
        message: `Tenant "${tenant.name}" desactivado. Use force=true para eliminación permanente.`
      })
    }

    // HARD DELETE (force=true)
    const isPostgres = tenant.databaseUrl?.startsWith('postgresql://') || tenant.databaseUrl?.startsWith('postgres://')

    if (isPostgres) {
      const schemaName = getSchemaName(id)

      // Use DIRECT_DATABASE_URL or DIRECT_URL for DDL operations
      const directUrl = process.env.DIRECT_DATABASE_URL || process.env.DIRECT_URL || process.env.DATABASE_URL

      if (directUrl) {
        const { PrismaClient } = await import('@prisma/client')
        const adminPrisma = new PrismaClient({
          datasources: { db: { url: directUrl } },
        })

        try {
          logger.info(`[DELETE TENANT] Eliminando schema: ${schemaName}`)
          await adminPrisma.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`)
          logger.info(`[DELETE TENANT] ✓ Schema ${schemaName} eliminado`)
        } catch (schemaError: any) {
          logger.error(`[DELETE TENANT] ⚠️ Error eliminando schema: ${schemaError?.message}`)
          // Continue with tenant deletion even if schema deletion fails
        } finally {
          await adminPrisma.$disconnect()
        }
      }
    }

    // Delete the tenant record from master database with retry
    await executeWithRetry(() => prisma.tenant.delete({
      where: { id }
    }))

    return NextResponse.json({ success: true, schemaDeleted: isPostgres })
  } catch (error: any) {
    logger.error('Error deleting tenant:', error)
    return NextResponse.json(
      { error: error.message || 'Error al eliminar tenant' },
      { status: 500 }
    )
  }
}


