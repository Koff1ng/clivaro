import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { rateLimiters } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'

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
          logger.warn(`[Tenant Verify] Límite de conexiones alcanzado, reintentando en ${backoffDelay}ms (intento ${attempt + 1}/${maxRetries})`)
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
    // Public endpoint: apply strict read rate limit by IP
    const rl = await rateLimiters.read(request, { scope: '/api/tenants/verify' })
    if (!rl.success) {
      return NextResponse.json(
        { error: rl.message || 'Too many requests', retryAfter: rl.retryAfter },
        {
          status: 429,
          headers: {
            'Retry-After': String(rl.retryAfter || 60),
            ...(rl.limit ? { 'X-RateLimit-Limit': String(rl.limit) } : {}),
            ...(typeof rl.remaining === 'number' ? { 'X-RateLimit-Remaining': String(rl.remaining) } : {}),
            ...(rl.reset ? { 'X-RateLimit-Reset': String(rl.reset) } : {}),
          },
        }
      )
    }

    const { searchParams } = new URL(request.url)
    const slug = searchParams.get('slug')

    if (!slug) {
      return NextResponse.json(
        { error: 'Slug requerido' },
        { status: 400 }
      )
    }

    // Este endpoint siempre usa la BD maestra para verificar tenants
    // Usar retry logic para manejar errores de conexión
    const tenant = await executeWithRetry(() =>
      prisma.tenant.findUnique({
        where: { slug },
        select: {
          id: true,
          name: true,
          slug: true,
          active: true,
          databaseUrl: true,
        }
      })
    )

    if (!tenant) {
      return NextResponse.json(
        { error: 'Empresa no encontrada' },
        { status: 404 }
      )
    }

    const envUrl = process.env.DATABASE_URL || ''
    const isPostgresEnv = envUrl.startsWith('postgresql://') || envUrl.startsWith('postgres://')
    const tenantDbUrl = tenant.databaseUrl || ''
    const isTenantPostgres = tenantDbUrl.startsWith('postgresql://') || tenantDbUrl.startsWith('postgres://')
    const isTenantSqlite = tenantDbUrl.startsWith('file:')

    // No exponer la databaseUrl completa por seguridad
    return NextResponse.json({
      tenant: {
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        active: tenant.active,
      },
      dbMode: isTenantPostgres ? 'postgres' : isTenantSqlite ? (isPostgresEnv ? 'legacy_sqlite' : 'sqlite') : 'unknown',
    })
  } catch (error: any) {
    const errorMessage = error?.message || String(error)
    const errorCode = error?.code || 'UNKNOWN_ERROR'
    
    logger.error('Error verifying tenant', error, { 
      endpoint: '/api/tenants/verify', 
      method: 'GET',
      errorMessage,
      errorCode,
    })
    
    // Si es un error de conexión a la base de datos, dar un mensaje más específico
    if (errorMessage.includes('MaxClientsInSessionMode') || errorMessage.includes('max clients reached')) {
      return NextResponse.json(
        { 
          error: 'Error de conexión a la base de datos. Por favor, intente nuevamente en unos momentos.',
          code: 'DATABASE_CONNECTION_ERROR',
        },
        { status: 503 }
      )
    }
    
    return NextResponse.json(
      { 
        error: 'Error al verificar la empresa',
        details: process.env.NODE_ENV === 'development' ? errorMessage : undefined,
        code: errorCode,
      },
      { status: 500 }
    )
  }
}


