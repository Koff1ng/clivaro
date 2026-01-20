import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-middleware'
import { prisma } from '@/lib/db'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

// Función helper para ejecutar consultas con retry
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
      
      if (errorMessage.includes('MaxClientsInSessionMode') || errorMessage.includes('max clients reached')) {
        if (attempt < maxRetries - 1) {
          const backoffDelay = Math.min(delay * Math.pow(2, attempt), 10000)
          logger.warn(`[Plans] Límite de conexiones alcanzado, reintentando en ${backoffDelay}ms (intento ${attempt + 1}/${maxRetries})`)
          await new Promise(resolve => setTimeout(resolve, backoffDelay))
          continue
        }
      }
      
      throw error
    }
  }
  throw lastError
}

/**
 * GET /api/plans
 * Obtiene todos los planes disponibles para que los tenants puedan verlos y cambiar
 */
export async function GET(request: Request) {
  try {
    const session = await requireAuth(request)
    
    if (session instanceof NextResponse) {
      return session
    }

    const user = session.user as any
    
    // Permitir tanto a tenants como a super admins ver los planes
    // Los tenants necesitan ver los planes para poder cambiar

    const plans = await executeWithRetry(() => prisma.plan.findMany({
      where: {
        active: true,
      },
      orderBy: {
        price: 'asc',
      },
      select: {
        id: true,
        name: true,
        description: true,
        price: true,
        currency: true,
        interval: true,
        features: true,
        active: true,
      },
    }))

    // Parsear features de JSON string a array
    const plansWithParsedFeatures = plans.map(plan => ({
      ...plan,
      features: plan.features ? JSON.parse(plan.features) : [],
    }))

    return NextResponse.json(plansWithParsedFeatures)
  } catch (error: any) {
    logger.error('Error fetching plans', error)
    return NextResponse.json(
      { error: error.message || 'Error al obtener planes' },
      { status: 500 }
    )
  }
}

