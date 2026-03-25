import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/api-middleware'
import { PERMISSIONS } from '@/lib/permissions'
import { withTenantRead } from '@/lib/tenancy'
import { logger } from '@/lib/logger'
import { startOfDay, startOfWeek, startOfMonth, startOfYear, subDays, subWeeks, subMonths, subYears } from 'date-fns'

export const dynamic = 'force-dynamic'

function getPeriodRange(period: string) {
  const now = new Date()
  switch (period) {
    case 'today':
      return { current: startOfDay(now), previous: startOfDay(subDays(now, 1)), prevEnd: startOfDay(now) }
    case 'week':
      return { current: startOfWeek(now, { weekStartsOn: 1 }), previous: startOfWeek(subWeeks(now, 1), { weekStartsOn: 1 }), prevEnd: startOfWeek(now, { weekStartsOn: 1 }) }
    case 'year':
      return { current: startOfYear(now), previous: startOfYear(subYears(now, 1)), prevEnd: startOfYear(now) }
    case 'month':
    default:
      return { current: startOfMonth(now), previous: startOfMonth(subMonths(now, 1)), prevEnd: startOfMonth(now) }
  }
}

export async function GET(request: Request) {
  const startTime = Date.now()
  logger.apiRequest('GET', '/api/dashboard/stats')

  try {
    const session = await requirePermission(request as any, PERMISSIONS.VIEW_REPORTS)
    if (session instanceof NextResponse) return session

    const user = session.user as any
    const tenantId = user.tenantId
    if (!tenantId) return NextResponse.json({ error: 'Tenant context required' }, { status: 403 })

    const { searchParams } = new URL(request.url)
    const period = searchParams.get('period') || 'month'
    const { current, previous, prevEnd } = getPeriodRange(period)

    const result = await withTenantRead(tenantId, async (prisma) => {
      const today = startOfDay(new Date())

      const safeQuery = async <T>(fn: () => Promise<T>, fallback: T): Promise<T> => {
        try { return await fn() } catch { return fallback }
      }

      const paidStatuses = ['PAGADA', 'PAID', 'EN_COBRANZA', 'PARCIAL', 'PARTIAL']

      const [
        salesToday,
        salesPeriod,
        salesPreviousPeriod,
        profitPeriod,
        profitPreviousPeriod,
        salesCountPeriod,
        salesCountPrevious,
        totalProducts,
        lowStockCount,
        inCollection
      ] = await Promise.all([
        // Sales today
        safeQuery(() => prisma.invoice.aggregate({
          where: { status: { in: paidStatuses }, createdAt: { gte: today } },
          _sum: { total: true },
        }), { _sum: { total: 0 } }),

        // Sales current period
        safeQuery(() => prisma.invoice.aggregate({
          where: { status: { in: paidStatuses }, createdAt: { gte: current } },
          _sum: { total: true },
        }), { _sum: { total: 0 } }),

        // Sales previous period
        safeQuery(() => prisma.invoice.aggregate({
          where: { status: { in: paidStatuses }, createdAt: { gte: previous, lt: prevEnd } },
          _sum: { total: true },
        }), { _sum: { total: 0 } }),

        // Profit current period
        safeQuery(async () => {
          const invoices = await prisma.invoice.findMany({
            where: { status: { in: paidStatuses }, createdAt: { gte: current } },
            select: {
              subtotal: true, discount: true, total: true, tax: true,
              items: { select: { quantity: true, product: { select: { cost: true } } } },
            },
          })
          const revenue = invoices.reduce((sum: number, inv: any) => {
            const s = typeof inv.subtotal === 'number' ? inv.subtotal : 0
            const d = typeof inv.discount === 'number' ? inv.discount : 0
            return sum + (s === 0 ? ((inv.total || 0) - (inv.tax || 0)) : s) - d
          }, 0)
          const cogs = invoices.reduce((s: number, inv: any) =>
            s + inv.items.reduce((is: number, i: any) => is + i.quantity * (i.product?.cost || 0), 0), 0)
          return revenue - cogs
        }, 0),

        // Profit previous period
        safeQuery(async () => {
          const invoices = await prisma.invoice.findMany({
            where: { status: { in: paidStatuses }, createdAt: { gte: previous, lt: prevEnd } },
            select: {
              subtotal: true, discount: true, total: true, tax: true,
              items: { select: { quantity: true, product: { select: { cost: true } } } },
            },
          })
          const revenue = invoices.reduce((sum: number, inv: any) => {
            const s = typeof inv.subtotal === 'number' ? inv.subtotal : 0
            const d = typeof inv.discount === 'number' ? inv.discount : 0
            return sum + (s === 0 ? ((inv.total || 0) - (inv.tax || 0)) : s) - d
          }, 0)
          const cogs = invoices.reduce((s: number, inv: any) =>
            s + inv.items.reduce((is: number, i: any) => is + i.quantity * (i.product?.cost || 0), 0), 0)
          return revenue - cogs
        }, 0),

        // Sales count current period
        safeQuery(() => prisma.invoice.count({
          where: { status: { in: ['PAGADA', 'PAID'] }, createdAt: { gte: current } },
        }), 0),

        // Sales count previous period
        safeQuery(() => prisma.invoice.count({
          where: { status: { in: ['PAGADA', 'PAID'] }, createdAt: { gte: previous, lt: prevEnd } },
        }), 0),

        // Total products
        safeQuery(() => prisma.product.count({ where: { active: true } }), 0),

        // Low stock
        safeQuery(async () => {
          const levels = await prisma.stockLevel.findMany({
            where: { product: { active: true, trackStock: true }, minStock: { gt: 0 } },
            select: { quantity: true, minStock: true },
          })
          return levels.reduce((c: number, l: any) => (l.minStock > 0 && l.quantity <= l.minStock) ? c + 1 : c, 0)
        }, 0),

        // In collection
        safeQuery(async () => {
          const unpaid = await prisma.invoice.findMany({
            where: { status: { notIn: ['PAGADA', 'PAID', 'ANULADA', 'VOID'] } },
            include: { payments: { select: { amount: true } } },
          })
          return unpaid.reduce((t: number, inv: any) => {
            const paid = inv.payments.reduce((s: number, p: any) => s + p.amount, 0)
            const pending = inv.total - paid
            return pending > 0 ? t + pending : t
          }, 0)
        }, 0),
      ])

      return {
        salesToday: (salesToday as any)._sum.total || 0,
        salesMonth: (salesPeriod as any)._sum.total || 0,
        profitMonth: profitPeriod,
        salesCount: salesCountPeriod,
        totalProducts,
        lowStockCount,
        inCollection,
        previousSales: (salesPreviousPeriod as any)._sum.total || 0,
        previousProfit: profitPreviousPeriod,
        previousSalesCount: salesCountPrevious,
      }
    })

    const duration = Date.now() - startTime
    logger.apiResponse('GET', '/api/dashboard/stats', 200, duration)
    return NextResponse.json(result)
  } catch (error: any) {
    const duration = Date.now() - startTime
    logger.error('Error fetching dashboard stats', error, {
      endpoint: '/api/dashboard/stats', method: 'GET', duration,
    })
    return NextResponse.json(
      { error: 'Failed to fetch stats', details: error?.message || String(error) },
      { status: 500 }
    )
  }
}
