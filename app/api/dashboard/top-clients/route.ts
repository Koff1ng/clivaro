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
          logger.warn(`[Top Clients] Límite de conexiones alcanzado, reintentando en ${backoffDelay}ms (intento ${attempt + 1}/${maxRetries})`)
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
    // Obtener top clientes por total de facturas (con retry logic)
    const topClients = await executeWithRetry(() => prisma.customer.findMany({
      include: {
        invoices: {
          select: {
            total: true,
            status: true,
          },
        },
      },
      take: 10,
    }))

    const clientsWithTotal = topClients
      .map(customer => ({
        id: customer.id,
        name: customer.name,
        total: customer.invoices
          .filter(inv => inv.status === 'PAGADA' || inv.status === 'PAID') // Compatibilidad con estados antiguos y nuevos
          .reduce((sum, inv) => sum + inv.total, 0),
      }))
      .filter(c => c.total > 0)
      .sort((a, b) => b.total - a.total)
      .slice(0, 5)

    return NextResponse.json(clientsWithTotal)
  } catch (error: any) {
    logger.error('Error fetching top clients', error, { 
      endpoint: '/api/dashboard/top-clients', 
      method: 'GET',
      errorMessage: error?.message,
      errorCode: error?.code,
      errorName: error?.name,
    })
    return NextResponse.json(
      { 
        error: 'Failed to fetch top clients', 
        details: error?.message || String(error),
        code: error?.code || 'UNKNOWN_ERROR',
      },
      { status: 500 }
    )
  }
}

