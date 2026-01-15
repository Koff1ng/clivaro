import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/api-middleware'
import { PERMISSIONS } from '@/lib/permissions'
import { getPrismaForRequest } from '@/lib/get-tenant-prisma'

export async function GET(request: Request) {
  const session = await requirePermission(request as any, PERMISSIONS.VIEW_REPORTS)
  
  if (session instanceof NextResponse) {
    return session
  }

  // Obtener el cliente Prisma correcto (tenant o master según el usuario)
  const prisma = await getPrismaForRequest(request, session)

  try {
    const topProducts = await prisma.invoiceItem.groupBy({
      by: ['productId'],
      _sum: {
        quantity: true,
        subtotal: true,
      },
      where: {
        invoice: {
          status: { in: ['PAGADA', 'PAID'] }, // Compatibilidad con estados antiguos y nuevos
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

    const result = topProducts.map(item => ({
      productId: item.productId,
      productName: productMap.get(item.productId) || 'Unknown',
      totalQuantity: item._sum.quantity || 0,
      totalRevenue: item._sum.subtotal || 0,
    }))

    return NextResponse.json(result)
  } catch (error) {
    console.error('Error fetching top products:', error)
    return NextResponse.json(
      { error: 'Failed to fetch top products' },
      { status: 500 }
    )
  }
}

