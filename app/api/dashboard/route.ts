import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/api-middleware'
import { PERMISSIONS } from '@/lib/permissions'
import { getPrismaForRequest } from '@/lib/get-tenant-prisma'
import { logger } from '@/lib/logger'
import { startOfDay, startOfMonth } from 'date-fns'
import { getCache, setCache, cacheKeys } from '@/lib/cache'

export const dynamic = 'force-dynamic'
export const revalidate = 30 // Next.js revalidation hint (30 seconds)

/**
 * Unified dashboard endpoint that consolidates all dashboard data
 * Implements 30-second cache to reduce database load
 */
export async function GET(request: Request) {
  const startTime = Date.now()
  logger.apiRequest('GET', '/api/dashboard')

  try {
    const session = await requirePermission(request as any, PERMISSIONS.VIEW_REPORTS)

    if (session instanceof NextResponse) {
      return session
    }

    const user = session.user as any
    const tenantId = user.tenantId || 'master'

    // Check cache first
    const cacheKey = cacheKeys.dashboard(tenantId)
    const cached = await getCache<any>(cacheKey)
    if (cached) {
      logger.apiResponse('GET', '/api/dashboard', 200, Date.now() - startTime, { cached: true })
      return NextResponse.json(cached, {
        headers: {
          'X-Cache': 'HIT',
          'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60',
        },
      })
    }

    // Obtener el cliente Prisma correcto (tenant o master según el usuario)
    const prisma = await getPrismaForRequest(request, session)

    const withRetry = async <T,>(fn: () => Promise<T>, label: string, retries = 5): Promise<T> => {
      let lastError: unknown
      for (let attempt = 0; attempt <= retries; attempt++) {
        try {
          return await fn()
        } catch (error: any) {
          lastError = error
          const errorMessage = error?.message || String(error)

          if (errorMessage.includes('MaxClientsInSessionMode') || errorMessage.includes('max clients reached')) {
            if (attempt < retries) {
              const backoffDelay = Math.min(2000 * Math.pow(2, attempt), 15000)
              logger.warn(`[Dashboard] Límite de conexiones alcanzado en ${label}, reintentando en ${backoffDelay}ms (intento ${attempt + 1}/${retries + 1})`)
              await new Promise(resolve => setTimeout(resolve, backoffDelay))
              continue
            }
          }

          logger.warn(`Retrying dashboard query: ${label}`, {
            attempt,
            error: errorMessage,
          })
          if (attempt < retries) {
            await new Promise(resolve => setTimeout(resolve, 500 * (attempt + 1)))
          }
        }
      }
      throw lastError
    }

    const today = startOfDay(new Date())
    const monthStart = startOfMonth(new Date())
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    // Execute all queries in parallel
    const [
      stats,
      topClients,
      last30Days,
      productCategories,
      activityFeed,
    ] = await Promise.all([
      // Stats
      (async () => {
        const [
          salesToday,
          salesMonth,
          profitMonth,
          salesCount,
          totalProducts,
          lowStockCount,
          inCollection,
        ] = await Promise.all([
          withRetry(
            () =>
              prisma.invoice.aggregate({
                where: {
                  status: { in: ['PAGADA', 'PAID', 'EN_COBRANZA', 'PARCIAL', 'PARTIAL'] },
                  createdAt: { gte: today },
                },
                _sum: { total: true },
              }),
            'salesToday'
          ),
          withRetry(
            () =>
              prisma.invoice.aggregate({
                where: {
                  status: { in: ['PAGADA', 'PAID', 'EN_COBRANZA', 'PARCIAL', 'PARTIAL'] },
                  createdAt: { gte: monthStart },
                },
                _sum: { total: true },
              }),
            'salesMonth'
          ),
          withRetry(async () => {
            const invoices = await prisma.invoice.findMany({
              where: {
                status: { in: ['PAGADA', 'PAID', 'EN_COBRANZA', 'PARCIAL', 'PARTIAL'] },
                createdAt: { gte: monthStart },
              },
              select: {
                subtotal: true,
                discount: true,
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
              const invoiceSubtotal = typeof inv.subtotal === 'number' ? inv.subtotal : 0
              const invoiceDiscount = typeof inv.discount === 'number' ? inv.discount : 0
              if (invoiceSubtotal === 0) {
                const calculatedSubtotal = (inv.total || 0) - (inv.tax || 0)
                return sum + calculatedSubtotal - invoiceDiscount
              }
              return sum + invoiceSubtotal - invoiceDiscount
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
          }, 'profitMonth'),
          withRetry(async () => {
            const activeShift = await prisma.cashShift.findFirst({
              where: { status: 'OPEN' },
              select: { id: true, openedAt: true, userId: true },
            })

            if (!activeShift) return 0

            return await prisma.invoice.count({
              where: {
                createdAt: { gte: activeShift.openedAt },
                createdById: activeShift.userId,
                status: { in: ['PAGADA', 'PAID'] },
              },
            })
          }, 'salesCount'),
          withRetry(
            () =>
              prisma.product.count({
                where: { active: true },
              }),
            'totalProducts'
          ),
          withRetry(async () => {
            const levels = await prisma.stockLevel.findMany({
              where: {
                product: { active: true, trackStock: true },
                minStock: { gt: 0 },
              },
              select: { quantity: true, minStock: true },
            })
            return levels.reduce((count, level) => {
              return (level.minStock > 0 && level.quantity <= level.minStock) ? count + 1 : count
            }, 0)
          }, 'lowStockCount'),
          withRetry(async () => {
            const unpaidInvoices = await prisma.invoice.findMany({
              where: {
                status: { notIn: ['PAGADA', 'PAID', 'ANULADA', 'VOID'] },
              },
              select: {
                total: true,
                payments: {
                  select: { amount: true },
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
          }, 'inCollection'),
        ])

        return {
          salesToday: salesToday._sum.total || 0,
          salesMonth: salesMonth._sum.total || 0,
          profitMonth,
          salesCount,
          totalProducts,
          lowStockCount,
          inCollection,
        }
      })(),

      // Top Clients
      withRetry(async () => {
        const topClients = await prisma.customer.findMany({
          include: {
            invoices: {
              select: {
                total: true,
                status: true,
              },
            },
          },
          take: 10,
        })

        return topClients
          .map(customer => ({
            id: customer.id,
            name: customer.name,
            total: customer.invoices
              .filter(inv => inv.status === 'PAGADA' || inv.status === 'PAID')
              .reduce((sum, inv) => sum + inv.total, 0),
          }))
          .filter(c => c.total > 0)
          .sort((a, b) => b.total - a.total)
          .slice(0, 5)
      }, 'topClients'),

      // Last 30 Days
      withRetry(async () => {
        const invoices = await prisma.invoice.findMany({
          where: {
            createdAt: { gte: thirtyDaysAgo },
            status: { in: ['PAGADA', 'PAID', 'EN_COBRANZA', 'PARCIAL', 'PARTIAL'] },
          },
          select: {
            total: true,
            createdAt: true,
          },
        })

        const salesByDay: Record<string, number> = {}
        invoices.forEach(invoice => {
          const dateKey = invoice.createdAt.toISOString().split('T')[0]
          salesByDay[dateKey] = (salesByDay[dateKey] || 0) + invoice.total
        })

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

        return days
      }, 'last30Days'),

      // Product Categories
      withRetry(async () => {
        const products = await prisma.product.findMany({
          where: { active: true },
          select: { id: true, category: true },
        })

        const stockLevels = await prisma.stockLevel.findMany({
          where: { productId: { not: null } },
          select: { productId: true, quantity: true },
        })

        const stockByProduct = new Map<string, number>()
        for (const sl of stockLevels) {
          const pid = sl.productId as string
          stockByProduct.set(pid, (stockByProduct.get(pid) || 0) + Number(sl.quantity || 0))
        }

        const categoryStock: Record<string, number> = {}
        for (const p of products) {
          const category = p.category || 'Sin categoría'
          const totalStock = stockByProduct.get(p.id) || 0
          categoryStock[category] = (categoryStock[category] || 0) + totalStock
        }

        return Object.entries(categoryStock)
          .filter(([, stock]) => stock > 0)
          .map(([name, value]) => ({ name, value: Math.round(value * 100) / 100 }))
          .sort((a, b) => b.value - a.value)
      }, 'productCategories'),

      // Activity Feed (limited to 10 for dashboard)
      withRetry(async () => {
        const limit = 10
        const activities: any[] = []

        const [
          stockAdjustments,
          payments,
          invoices,
        ] = await Promise.all([
          prisma.stockMovement.findMany({
            take: limit,
            where: {
              OR: [
                { reference: { startsWith: 'ADJ-' } },
                { reason: { contains: 'Ajuste' } },
              ],
            },
            include: {
              product: { select: { id: true, name: true, sku: true } },
              createdBy: { select: { id: true, name: true } },
            },
            orderBy: { createdAt: 'desc' },
          }).catch(() => []),
          prisma.payment.findMany({
            take: limit,
            select: {
              id: true,
              amount: true,
              method: true,
              createdAt: true,
              invoice: {
                select: {
                  id: true,
                  number: true,
                  customer: {
                    select: { id: true, name: true },
                  },
                },
              },
            },
            orderBy: { createdAt: 'desc' },
          }).catch(() => []),
          prisma.invoice.findMany({
            take: limit,
            select: {
              id: true,
              number: true,
              total: true,
              status: true,
              createdAt: true,
              customer: {
                select: { id: true, name: true },
              },
            },
            orderBy: { createdAt: 'desc' },
          }).catch(() => []),
        ])

        stockAdjustments.forEach(adj => {
          activities.push({
            type: 'stock_adjustment',
            id: adj.id,
            description: `Ajuste de inventario: ${adj.product?.name || adj.productId}`,
            createdAt: adj.createdAt,
            user: adj.createdBy?.name,
          })
        })

        payments.forEach(payment => {
          activities.push({
            type: 'payment',
            id: payment.id,
            description: `Pago de ${payment.amount} por factura ${payment.invoice?.number ?? payment.invoice?.id ?? payment.id}`,
            createdAt: payment.createdAt,
            customer: payment.invoice?.customer?.name,
          })
        })

        invoices.forEach(invoice => {
          activities.push({
            type: 'invoice',
            id: invoice.id,
            description: `Factura ${invoice.number} por ${invoice.total}`,
            createdAt: invoice.createdAt,
            customer: invoice.customer?.name,
            status: invoice.status,
          })
        })

        return activities
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
          .slice(0, limit)
      }, 'activityFeed'),
    ])

    const result = {
      stats,
      topClients,
      last30Days,
      productCategories,
      activityFeed,
    }

    // Cache for 30 seconds
    await setCache(cacheKey, result, 30)

    const duration = Date.now() - startTime
    logger.apiResponse('GET', '/api/dashboard', 200, duration, { cached: false })

    return NextResponse.json(result, {
      headers: {
        'X-Cache': 'MISS',
        'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60',
      },
    })
  } catch (error: any) {
    const duration = Date.now() - startTime
    logger.error('Error fetching dashboard', error, {
      endpoint: '/api/dashboard',
      method: 'GET',
      duration,
      errorMessage: error?.message,
      errorCode: error?.code,
      errorName: error?.name,
    })
    return NextResponse.json(
      {
        error: 'Failed to fetch dashboard data',
        details: error?.message || String(error),
        code: error?.code || 'UNKNOWN_ERROR',
      },
      { status: 500 }
    )
  }
}

