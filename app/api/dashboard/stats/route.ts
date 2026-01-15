import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/api-middleware'
import { PERMISSIONS } from '@/lib/permissions'
import { getPrismaForRequest } from '@/lib/get-tenant-prisma'
import { logger } from '@/lib/logger'
import { startOfDay, startOfMonth } from 'date-fns'

export async function GET(request: Request) {
  const startTime = Date.now()
  logger.apiRequest('GET', '/api/dashboard/stats')
  
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
            status: { in: ['PAGADA', 'PAID'] }, // Compatibilidad con estados antiguos y nuevos
            OR: [
              { issuedAt: { gte: today } },
              { issuedAt: null, createdAt: { gte: today } },
            ],
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
            status: { in: ['PAGADA', 'PAID'] }, // Compatibilidad con estados antiguos y nuevos
            OR: [
              { issuedAt: { gte: monthStart } },
              { issuedAt: null, createdAt: { gte: monthStart } },
            ],
          },
          _sum: {
            total: true,
          },
        }),
      'salesMonth'
    )

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
        },
        select: {
          quantity: true,
          minStock: true,
        },
      })
      return levels.reduce((count, level) => {
        return level.quantity <= level.minStock ? count + 1 : count
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
      totalProducts,
      lowStockCount,
      inCollection,
    })
  } catch (error: any) {
    logger.error('Error fetching dashboard stats', error, {
      endpoint: '/api/dashboard/stats',
      method: 'GET',
    })
    return NextResponse.json(
      { error: 'Failed to fetch stats', details: error?.message || String(error) },
      { status: 500 }
    )
  }
}

