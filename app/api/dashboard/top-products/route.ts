import { NextResponse } from 'next/server'
import { logger } from '@/lib/logger'
import { requirePermission } from '@/lib/api-middleware'
import { PERMISSIONS } from '@/lib/permissions'
import { withTenantRead } from '@/lib/tenancy'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const session = await requirePermission(request as any, PERMISSIONS.VIEW_REPORTS)

  if (session instanceof NextResponse) {
    return session
  }

  const tenantId = (session.user as any).tenantId

  try {
    const result = await withTenantRead(tenantId, async (prisma) => {
      const topProducts = await prisma.invoiceItem.groupBy({
        by: ['productId'],
        _sum: {
          quantity: true,
          subtotal: true,
        },
        where: {
          invoice: {
            status: { in: ['PAGADA', 'PAID'] },
          },
        },
        orderBy: {
          _sum: {
            subtotal: 'desc',
          },
        },
        take: 10,
      })

      const productIds = topProducts.map(p => p.productId)
      const products = await prisma.product.findMany({
        where: {
          id: {
            in: productIds,
          },
        },
      })

      const productMap = new Map(products.map(p => [p.id, p.name]))

      return topProducts.map(item => ({
        productId: item.productId,
        productName: productMap.get(item.productId) || 'Unknown',
        totalQuantity: item._sum.quantity || 0,
        totalRevenue: item._sum.subtotal || 0,
      }))
    })

    return NextResponse.json(result)
  } catch (error) {
    logger.error('Error fetching top products:', error)
    return NextResponse.json(
      { error: 'Failed to fetch top products' },
      { status: 500 }
    )
  }
}

