import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { rateLimiters } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

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
  } catch (error) {
    logger.error('Error verifying tenant', error, { endpoint: '/api/tenants/verify', method: 'GET' })
    return NextResponse.json(
      { error: 'Error al verificar la empresa' },
      { status: 500 }
    )
  }
}


