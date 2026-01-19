import { NextResponse } from 'next/server'
import { requireAnyPermission } from '@/lib/api-middleware'
import { PERMISSIONS } from '@/lib/permissions'
import { getPrismaForRequest } from '@/lib/get-tenant-prisma'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

// Función helper para ejecutar consultas con retry y manejo de errores de conexión
async function executeWithRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 5,
  delay = 2000
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
          const backoffDelay = Math.min(delay * Math.pow(2, attempt), 15000) // Backoff exponencial, max 15s
          logger.warn(`[Low Stock] Límite de conexiones alcanzado, reintentando en ${backoffDelay}ms (intento ${attempt + 1}/${maxRetries})`)
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
  // Permitir acceso con MANAGE_INVENTORY o VIEW_REPORTS (para dashboard)
  const session = await requireAnyPermission(request as any, [PERMISSIONS.MANAGE_INVENTORY, PERMISSIONS.VIEW_REPORTS])
  
  if (session instanceof NextResponse) {
    return session
  }

  // Obtener el cliente Prisma correcto (tenant o master según el usuario)
  const prisma = await getPrismaForRequest(request, session)

  try {
    const allStockLevels = await executeWithRetry(() => prisma.stockLevel.findMany({
      where: {
        product: {
          active: true,
          trackStock: true,
        },
      },
      include: {
        product: true,
        warehouse: true,
      },
    }))

    // Filter where quantity <= minStock (solo si minStock está configurado)
    const lowStockItems = allStockLevels.filter(item => 
      item.minStock != null && item.minStock > 0 && item.quantity <= item.minStock
    ).slice(0, 20)

    const result = lowStockItems.map(item => ({
      id: item.id,
      productName: item.product?.name || 'Unknown',
      warehouseName: item.warehouse.name,
      quantity: item.quantity,
      minStock: item.minStock,
    }))

    return NextResponse.json(result)
  } catch (error: any) {
    logger.error('Error fetching low stock', error, { 
      endpoint: '/api/inventory/low-stock', 
      method: 'GET',
      errorMessage: error?.message,
      errorCode: error?.code,
      errorName: error?.name,
    })
    return NextResponse.json(
      { 
        error: 'Failed to fetch low stock', 
        details: error?.message || String(error),
        code: error?.code || 'UNKNOWN_ERROR',
      },
      { status: 500 }
    )
  }
}

