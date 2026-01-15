import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/api-middleware'
import { PERMISSIONS } from '@/lib/permissions'
import { getPrismaForRequest } from '@/lib/get-tenant-prisma'
import { logger } from '@/lib/logger'
import { startOfDay, startOfMonth } from 'date-fns'

export async function GET(request: Request) {
  const startTime = Date.now()
  logger.apiRequest('GET', '/api/dashboard/stats')
  
  try {
    const session = await requirePermission(request as any, PERMISSIONS.VIEW_REPORTS)
    
    if (session instanceof NextResponse) {
      return session
    }

    // Obtener el cliente Prisma correcto (tenant o master según el usuario)
    const prisma = await getPrismaForRequest(request, session)

  const withRetry = async <T,>(fn: () => Promise<T>, label: string, retries = 2): Promise<T> => {
    let lastError: unknown
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        return await fn()
      } catch (error) {
        lastError = error
        logger.warn(`Retrying dashboard stats query: ${label}`, {
          attempt,
          error: (error as any)?.message || error,
        })
        if (attempt < retries) {
          await new Promise(resolve => setTimeout(resolve, 250 * (attempt + 1)))
        }
      }
    }
    throw lastError
  }

  try {
    const today = startOfDay(new Date())
    const monthStart = startOfMonth(new Date())

    const salesToday = await withRetry(
      () =>
        prisma.invoice.aggregate({
          where: {
            status: { in: ['PAGADA', 'PAID', 'EN_COBRANZA', 'PARCIAL', 'PARTIAL'] }, // Compatibilidad con estados antiguos y nuevos
            createdAt: { gte: today },
          },
          _sum: {
            total: true,
          },
        }),
      'salesToday'
    )

    const salesMonth = await withRetry(
      () =>
        prisma.invoice.aggregate({
          where: {
            status: { in: ['PAGADA', 'PAID', 'EN_COBRANZA', 'PARCIAL', 'PARTIAL'] }, // Compatibilidad con estados antiguos y nuevos
            createdAt: { gte: monthStart },
          },
          _sum: {
            total: true,
          },
        }),
      'salesMonth'
    )

    // Ganancia del mes (sin impuestos): (subtotal - costo) agregado
    const profitMonth = await withRetry(async () => {
      const invoices = await prisma.invoice.findMany({
        where: {
          status: { in: ['PAGADA', 'PAID', 'EN_COBRANZA', 'PARCIAL', 'PARTIAL'] },
          createdAt: { gte: monthStart },
        },
        select: {
          subtotal: true,
          total: true,
          tax: true,
          items: {
            select: {
              quantity: true,
              product: {
                select: { cost: true },
              },
            },
          },
        },
      })

      const subtotalWithoutTaxes = invoices.reduce((sum, inv) => {
        if (typeof inv.subtotal === 'number') return sum + inv.subtotal
        return sum + ((inv.total || 0) - (inv.tax || 0))
      }, 0)

      const costOfGoodsSold = invoices.reduce((sum, inv) => {
        return (
          sum +
          inv.items.reduce((itemSum, item) => {
            const cost = item.product?.cost || 0
            return itemSum + item.quantity * cost
          }, 0)
        )
      }, 0)

      return subtotalWithoutTaxes - costOfGoodsSold
    }, 'profitMonth')

    // Número de ventas = número de facturas pagadas en el turno activo
    const salesCount = await withRetry(async () => {
      // Buscar turno activo
      const activeShift = await prisma.cashShift.findFirst({
        where: {
          status: 'OPEN',
        },
        select: {
          id: true,
          openedAt: true,
          userId: true,
        },
      })

      if (!activeShift) {
        // Si no hay turno activo, retornar 0
        return 0
      }

      // Contar facturas pagadas creadas durante el turno activo
      const paidInvoicesCount = await prisma.invoice.count({
        where: {
          createdAt: {
            gte: activeShift.openedAt,
          },
          createdById: activeShift.userId,
          status: {
            in: ['PAGADA', 'PAID'], // Solo facturas completamente pagadas
          },
        },
      })

      return paidInvoicesCount
    }, 'salesCount')

    const totalProducts = await withRetry(
      () =>
        prisma.product.count({
          where: {
            active: true,
          },
        }),
      'totalProducts'
    )

    const lowStockCount = await withRetry(async () => {
      const levels = await prisma.stockLevel.findMany({
        where: {
          product: {
            active: true,
            trackStock: true,
          },
          minStock: {
            not: null,
            gt: 0, // Solo niveles con minStock configurado
          },
        },
        select: {
          quantity: true,
          minStock: true,
        },
      })
      return levels.reduce((count, level) => {
        // Verificar que minStock no sea null y que quantity sea menor o igual
        return (level.minStock != null && level.minStock > 0 && level.quantity <= level.minStock) ? count + 1 : count
      }, 0)
    }, 'lowStockCount')

    const inCollection = await withRetry(async () => {
      const unpaidInvoices = await prisma.invoice.findMany({
        where: {
          status: {
            notIn: ['PAGADA', 'PAID', 'ANULADA', 'VOID'], // Compatibilidad con estados antiguos y nuevos
          },
        },
        include: {
          payments: {
            select: {
              amount: true,
            },
          },
        },
      })

      let totalInCollection = 0
      for (const invoice of unpaidInvoices) {
        const totalPaid = invoice.payments.reduce((sum, payment) => sum + payment.amount, 0)
        const pending = invoice.total - totalPaid
        if (pending > 0) {
          totalInCollection += pending
        }
      }

      return totalInCollection
    }, 'inCollection')

    const duration = Date.now() - startTime
    logger.apiResponse('GET', '/api/dashboard/stats', 200, duration)

    return NextResponse.json({
      salesToday: salesToday._sum.total || 0,
      salesMonth: salesMonth._sum.total || 0,
      profitMonth,
      salesCount, // Número de facturas pagadas en el turno activo
      totalProducts,
      lowStockCount,
      inCollection,
    })
  } catch (error: any) {
    const duration = Date.now() - startTime
    logger.error('Error fetching dashboard stats', error, {
      endpoint: '/api/dashboard/stats',
      method: 'GET',
      duration,
      errorMessage: error?.message,
      errorCode: error?.code,
      errorName: error?.name,
    })
    return NextResponse.json(
      { 
        error: 'Failed to fetch stats', 
        details: error?.message || String(error),
        code: error?.code || 'UNKNOWN_ERROR',
      },
      { status: 500 }
    )
  }
}

