import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { rateLimiters } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

// Función helper para ejecutar consultas con retry y manejo de errores de conexión
async function executeWithRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 10,
  delay = 2000
): Promise<T> {
  let lastError: any
  
  // Delay inicial más largo para dar tiempo a que se liberen conexiones
  await new Promise(resolve => setTimeout(resolve, 1000))
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error: any) {
      lastError = error
      const errorMessage = error?.message || String(error)
      const errorCode = error?.code || ''
      
      // Detectar errores de conexión más ampliamente
      const isConnectionError = 
        errorMessage.includes('MaxClientsInSessionMode') || 
        errorMessage.includes('max clients reached') ||
        errorMessage.includes('connection') ||
        errorMessage.includes('timeout') ||
        errorMessage.includes('ECONNREFUSED') ||
        errorMessage.includes('ETIMEDOUT') ||
        errorCode === 'P1001' || // Prisma connection error
        errorCode === 'P1002' || // Prisma timeout error
        errorCode === 'P1008' || // Prisma operation timeout
        errorCode === 'P1017'    // Prisma server closed connection
      
      if (isConnectionError) {
        if (attempt < maxRetries - 1) {
          // Backoff exponencial: 2s, 4s, 8s, 16s, 20s, 20s, 20s, 20s, 20s, 20s
          const backoffDelay = Math.min(delay * Math.pow(2, attempt), 20000) // Backoff exponencial, max 20s
          logger.warn(`[Tenant Verify] Error de conexión, reintentando en ${backoffDelay}ms (intento ${attempt + 1}/${maxRetries})`, {
            errorMessage: errorMessage.substring(0, 100),
            errorCode,
          })
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
    if (errorMessage.includes('MaxClientsInSessionMode') || 
        errorMessage.includes('max clients reached') ||
        errorMessage.includes('connection') ||
        errorMessage.includes('timeout') ||
        errorCode === 'P1001' || // Prisma connection error
        errorCode === 'P1002' || // Prisma timeout error
        errorCode === 'P1008') { // Prisma operation timeout
      return NextResponse.json(
        { 
          error: 'Error de conexión a la base de datos. Por favor, intente nuevamente en unos momentos.',
          code: 'DATABASE_CONNECTION_ERROR',
          retryAfter: 5, // Sugerir reintentar después de 5 segundos
        },
        { 
          status: 503,
          headers: {
            'Retry-After': '5',
          },
        }
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


