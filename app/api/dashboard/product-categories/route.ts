import { NextResponse } from 'next/server'
import { requireAnyPermission } from '@/lib/api-middleware'
import { PERMISSIONS } from '@/lib/permissions'
import { getPrismaForRequest } from '@/lib/get-tenant-prisma'
import { logger } from '@/lib/logger'

export async function GET(request: Request) {
  const session = await requireAnyPermission(request as any, [PERMISSIONS.VIEW_REPORTS, PERMISSIONS.MANAGE_INVENTORY, PERMISSIONS.MANAGE_SALES])
  if (session instanceof NextResponse) return session

  const prisma = await getPrismaForRequest(request, session)

  try {
    // Minimal reads: compute total stock by product category (productId stock only)
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

    const result = Object.entries(categoryStock)
      .filter(([, stock]) => stock > 0)
      .map(([name, value]) => ({ name, value: Math.round(value * 100) / 100 }))
      .sort((a, b) => b.value - a.value)

    return NextResponse.json({ categories: result }, { status: 200 })
  } catch (error: any) {
    logger.error('Error dashboard product-categories', error, { endpoint: '/api/dashboard/product-categories', method: 'GET' })
    return NextResponse.json({ error: error?.message || 'Failed to fetch product categories', code: 'SERVER_ERROR' }, { status: 500 })
  }
}


