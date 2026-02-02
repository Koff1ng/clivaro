import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/api-middleware'
import { PERMISSIONS } from '@/lib/permissions'
import { prisma as prismaClient } from '@/lib/db'
import { withTenantTx } from '@/lib/tenancy'
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

    // Use withTenantTx to ensure schema isolation
    const tenantId = (session.user as any).tenantId
    const isSuperAdmin = (session.user as any).isSuperAdmin

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
              logger.warn(`[Dashboard Stats] Límite de conexiones alcanzado en ${label}, reintentando en ${backoffDelay}ms (intento ${attempt + 1}/${retries + 1})`)
              await new Promise(resolve => setTimeout(resolve, backoffDelay))
              continue
            }
          }
          logger.warn(`Retrying dashboard stats query: ${label}`, { attempt, error: errorMessage })
          if (attempt < retries) {
            await new Promise(resolve => setTimeout(resolve, 500 * (attempt + 1)))
          }
        }
      }
      throw lastError
    }

    // Execute all stats logic within the tenant context if not super admin
    const statsCallback = async (prisma: any) => {
      const today = startOfDay(new Date())
      const monthStart = startOfMonth(new Date())

      // Ejecutar queries independientes en paralelo para mejor rendimiento
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
              _sum: {
                total: true,
              },
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
              _sum: {
                total: true,
              },
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
            return (
              sum +
              inv.items.reduce((itemSum: number, item: any) => {
                const cost = item.product?.cost || 0
                return itemSum + item.quantity * cost
              }, 0)
            )
          }, 0)

          return subtotalWithoutTaxes - costOfGoodsSold
        }, 'profitMonth'),
        withRetry(async () => {
          const activeShift = await prisma.cashShift.findFirst({
            where: {
              status: 'OPEN',
            },
            select: {
              openedAt: true,
              userId: true,
            },
          })

          if (!activeShift) return 0

          const paidInvoicesCount = await prisma.invoice.count({
            where: {
              createdAt: {
                gte: activeShift.openedAt,
              },
              createdById: activeShift.userId,
              status: {
                in: ['PAGADA', 'PAID'],
              },
            },
          })

          return paidInvoicesCount
        }, 'salesCount'),
        withRetry(
          () =>
            prisma.product.count({
              where: {
                active: true,
              },
            }),
          'totalProducts'
        ),
        withRetry(async () => {
          const levels = await prisma.stockLevel.findMany({
            where: {
              product: {
                active: true,
                trackStock: true,
              },
              minStock: {
                gt: 0,
              },
            },
            select: {
              quantity: true,
              minStock: true,
            },
          })
          return levels.reduce((count: number, level: any) => {
            return (level.minStock > 0 && level.quantity <= level.minStock) ? count + 1 : count
          }, 0)
        }, 'lowStockCount'),
        withRetry(async () => {
          const unpaidInvoices = await prisma.invoice.findMany({
            where: {
              status: {
                notIn: ['PAGADA', 'PAID', 'ANULADA', 'VOID'],
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
            const totalPaid = invoice.payments.reduce((sum: number, payment: any) => sum + payment.amount, 0)
            const pending = invoice.total - totalPaid
            if (pending > 0) {
              totalInCollection += pending
            }
          }

          return totalInCollection
        }, 'inCollection'),
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
    }

    let stats
    if (isSuperAdmin && !tenantId) {
      // Super admins accessing global stats (public schema)
      stats = await statsCallback(prismaClient)
    } else {
      // Tenant-scoped stats
      const effectiveTenantId = tenantId || (session.user as any).tenantId
      if (!effectiveTenantId) {
        throw new Error('Tenant ID is required for non-superadmin users.')
      }
      stats = await withTenantTx(effectiveTenantId, statsCallback)
    }

    const duration = Date.now() - startTime
    logger.apiResponse('GET', '/api/dashboard/stats', 200, duration)

    return NextResponse.json(stats)

  } catch (error: any) {
    const duration = Date.now() - startTime
    logger.error('Error in dashboard stats endpoint', error, {
      endpoint: '/api/dashboard/stats',
      method: 'GET',
      duration,
      errorMessage: error?.message,
    })
    return NextResponse.json(
      {
        error: 'Failed to fetch stats',
        details: error?.message || String(error),
      },
      { status: 500 }
    )
  }
}

