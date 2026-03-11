import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/api-middleware'
import { PERMISSIONS } from '@/lib/permissions'
import { withTenantRead } from '@/lib/tenancy'
import { logger } from '@/lib/logger'
import { startOfDay, startOfMonth } from 'date-fns'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const startTime = Date.now()
  logger.apiRequest('GET', '/api/dashboard/stats')

  try {
    const session = await requirePermission(request as any, PERMISSIONS.VIEW_REPORTS)

    if (session instanceof NextResponse) {
      return session
    }

    const user = session.user as any
    const tenantId = user.tenantId

    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant context required' }, { status: 403 })
    }

    const result = await withTenantRead(tenantId, async (prisma) => {
      const today = startOfDay(new Date())
      const monthStart = startOfMonth(new Date())

      const [
        salesToday,
        salesMonth,
        profitMonth,
        salesCount,
        totalProducts,
        lowStockCount,
        inCollection,
      ] = await Promise.all([
        // salesToday
        prisma.invoice.aggregate({
          where: {
            status: { in: ['PAGADA', 'PAID', 'EN_COBRANZA', 'PARCIAL', 'PARTIAL'] },
            createdAt: { gte: today },
          },
          _sum: { total: true },
        }),
        // salesMonth
        prisma.invoice.aggregate({
          where: {
            status: { in: ['PAGADA', 'PAID', 'EN_COBRANZA', 'PARCIAL', 'PARTIAL'] },
            createdAt: { gte: monthStart },
          },
          _sum: { total: true },
        }),
        // profitMonth
        (async () => {
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
                  product: { select: { cost: true } },
                },
              },
            },
          })

          const subtotalWithoutTaxes = invoices.reduce((sum: number, inv: any) => {
            const invoiceSubtotal = typeof inv.subtotal === 'number' ? inv.subtotal : 0
            const invoiceDiscount = typeof inv.discount === 'number' ? inv.discount : 0
            if (invoiceSubtotal === 0) {
              const calculatedSubtotal = (inv.total || 0) - (inv.tax || 0)
              return sum + calculatedSubtotal - invoiceDiscount
            }
            return sum + invoiceSubtotal - invoiceDiscount
          }, 0)

          const costOfGoodsSold = invoices.reduce((sum: number, inv: any) => {
            return sum + inv.items.reduce((itemSum: number, item: any) => {
              const cost = item.product?.cost || 0
              return itemSum + item.quantity * cost
            }, 0)
          }, 0)

          return subtotalWithoutTaxes - costOfGoodsSold
        })(),
        // salesCount
        (async () => {
          const activeShift = await prisma.cashShift.findFirst({
            where: { status: 'OPEN' },
            select: { openedAt: true, userId: true },
          })
          if (!activeShift) return 0
          return await prisma.invoice.count({
            where: {
              createdAt: { gte: activeShift.openedAt },
              createdById: activeShift.userId,
              status: { in: ['PAGADA', 'PAID'] },
            },
          })
        })(),
        // totalProducts
        prisma.product.count({ where: { active: true } }),
        // lowStockCount
        (async () => {
          const levels = await prisma.stockLevel.findMany({
            where: {
              product: { active: true, trackStock: true },
              minStock: { gt: 0 },
            },
            select: { quantity: true, minStock: true },
          })
          return levels.reduce((count: number, level: any) => {
            return (level.minStock > 0 && level.quantity <= level.minStock) ? count + 1 : count
          }, 0)
        })(),
        // inCollection
        (async () => {
          const unpaidInvoices = await prisma.invoice.findMany({
            where: {
              status: { notIn: ['PAGADA', 'PAID', 'ANULADA', 'VOID'] },
            },
            include: {
              payments: { select: { amount: true } },
            },
          })
          let totalInCollection = 0
          for (const invoice of unpaidInvoices) {
            const totalPaid = invoice.payments.reduce((sum: number, p: any) => sum + p.amount, 0)
            const pending = invoice.total - totalPaid
            if (pending > 0) totalInCollection += pending
          }
          return totalInCollection
        })(),
      ])

      return {
        salesToday: (salesToday as any)._sum.total || 0,
        salesMonth: (salesMonth as any)._sum.total || 0,
        profitMonth,
        salesCount,
        totalProducts,
        lowStockCount,
        inCollection,
      }
    })

    const duration = Date.now() - startTime
    logger.apiResponse('GET', '/api/dashboard/stats', 200, duration)
    return NextResponse.json(result)
  } catch (error: any) {
    const duration = Date.now() - startTime
    logger.error('Error fetching dashboard stats', error, {
      endpoint: '/api/dashboard/stats',
      method: 'GET',
      duration,
    })
    return NextResponse.json(
      { error: 'Failed to fetch stats', details: error?.message || String(error) },
      { status: 500 }
    )
  }
}
