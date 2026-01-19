import { NextResponse } from 'next/server'
import { requireAnyPermission } from '@/lib/api-middleware'
import { PERMISSIONS } from '@/lib/permissions'
import { getPrismaForRequest } from '@/lib/get-tenant-prisma'
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
          logger.warn(`[Last 30 Days] Límite de conexiones alcanzado, reintentando en ${backoffDelay}ms (intento ${attempt + 1}/${maxRetries})`)
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
  const session = await requireAnyPermission(request as any, [PERMISSIONS.VIEW_REPORTS, PERMISSIONS.MANAGE_SALES])
  
  if (session instanceof NextResponse) {
    return session
  }

  const prisma = await getPrismaForRequest(request, session)

  try {
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    // Obtener ventas de los últimos 30 días agrupadas por día (con retry logic)
    const invoices = await executeWithRetry(() => prisma.invoice.findMany({
      where: {
        createdAt: {
          gte: thirtyDaysAgo,
        },
        status: {
          in: ['PAGADA', 'PAID', 'EN_COBRANZA', 'PARCIAL', 'PARTIAL'], // Compatibilidad con estados antiguos y nuevos
        },
      },
      select: {
        total: true,
        createdAt: true,
      },
    }))

    // Agrupar por día
    const salesByDay: Record<string, number> = {}
    invoices.forEach(invoice => {
      const dateKey = invoice.createdAt.toISOString().split('T')[0]
      salesByDay[dateKey] = (salesByDay[dateKey] || 0) + invoice.total
    })

    // Generar array para los últimos 30 días
    const days = []
    for (let i = 29; i >= 0; i--) {
      const date = new Date()
      date.setDate(date.getDate() - i)
      const dateKey = date.toISOString().split('T')[0]
      days.push({
        day: date.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' }),
        sales: salesByDay[dateKey] || 0,
      })
    }

    return NextResponse.json(days)
  } catch (error: any) {
    logger.error('Error fetching last 30 days', error, { 
      endpoint: '/api/dashboard/last-30-days', 
      method: 'GET',
      errorMessage: error?.message,
      errorCode: error?.code,
      errorName: error?.name,
    })
    return NextResponse.json(
      { 
        error: 'Failed to fetch last 30 days data', 
        details: error?.message || String(error),
        code: error?.code || 'UNKNOWN_ERROR',
      },
      { status: 500 }
    )
  }
}

