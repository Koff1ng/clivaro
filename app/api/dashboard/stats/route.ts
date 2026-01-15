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

  try {
    const today = startOfDay(new Date())
    const monthStart = startOfMonth(new Date())

    // Optimize: Run all queries in parallel
    const [salesToday, salesMonth, totalProducts, lowStockCount, inCollection] = await Promise.all([
      // Sales today
      prisma.invoice.aggregate({
      where: {
        status: { in: ['PAGADA', 'PAID'] }, // Compatibilidad con estados antiguos y nuevos
        issuedAt: {
          gte: today,
        },
      },
      _sum: {
        total: true,
      },
    }),
      // Sales this month
      prisma.invoice.aggregate({
        where: {
          status: { in: ['PAGADA', 'PAID'] }, // Compatibilidad con estados antiguos y nuevos
          issuedAt: {
            gte: monthStart,
          },
        },
        _sum: {
          total: true,
        },
      }),
      // Total products
      prisma.product.count({
        where: {
          active: true,
        },
      }),
      // Low stock count - Compare quantity with minStock using raw query
      (async () => {
        const result = await prisma.$queryRaw<Array<{ count: bigint }>>`
          SELECT COUNT(*) as count
          FROM StockLevel sl
          INNER JOIN Product p ON sl.productId = p.id
          WHERE p.active = 1 
            AND p.trackStock = 1
            AND sl.quantity <= sl.minStock
        `
        return Number(result[0]?.count || 0)
      })(),
      // En Cobranza: Suma de facturas pendientes de pago
      (async () => {
        // Obtener todas las facturas que no están completamente pagadas
        const unpaidInvoices = await prisma.invoice.findMany({
          where: {
            status: { 
              notIn: ['PAGADA', 'PAID', 'ANULADA', 'VOID'] // Excluir pagadas y anuladas (compatibilidad con estados antiguos y nuevos)
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

        // Calcular el monto pendiente de cada factura
        let totalInCollection = 0
        for (const invoice of unpaidInvoices) {
          const totalPaid = invoice.payments.reduce((sum, payment) => sum + payment.amount, 0)
          const pending = invoice.total - totalPaid
          if (pending > 0) {
            totalInCollection += pending
          }
        }

        return totalInCollection
      })(),
    ])

    const duration = Date.now() - startTime
    logger.apiResponse('GET', '/api/dashboard/stats', 200, duration)

    return NextResponse.json({
      salesToday: salesToday._sum.total || 0,
      salesMonth: salesMonth._sum.total || 0,
      totalProducts,
      lowStockCount,
      inCollection,
    })
  } catch (error) {
    logger.error('Error fetching dashboard stats', error, {
      endpoint: '/api/dashboard/stats',
      method: 'GET',
    })
    return NextResponse.json(
      { error: 'Failed to fetch stats' },
      { status: 500 }
    )
  }
}

