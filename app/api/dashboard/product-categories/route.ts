import { NextResponse } from 'next/server'
import { requireAnyPermission } from '@/lib/api-middleware'
import { PERMISSIONS } from '@/lib/permissions'
import { withTenantTx } from '@/lib/tenancy'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const session = await requireAnyPermission(request as any, [PERMISSIONS.VIEW_REPORTS, PERMISSIONS.MANAGE_INVENTORY, PERMISSIONS.MANAGE_SALES])
  if (session instanceof NextResponse) return session

  const tenantId = (session.user as any).tenantId
  const isSuperAdmin = (session.user as any).isSuperAdmin

  if (isSuperAdmin || !tenantId) {
    return NextResponse.json({ categories: [] })
  }

  try {
    const data = await withTenantTx(tenantId, async (tx: any) => {
      const products = await tx.product.findMany({
        where: { active: true },
        select: { id: true, category: true },
      })
      const stockLevels = await tx.stockLevel.findMany({
        where: { productId: { not: null } },
        select: { productId: true, quantity: true },
      })
      return { products, stockLevels }
    })

    const stockByProduct = new Map<string, number>()
    for (const sl of (data as any).stockLevels) {
      const pid = sl.productId as string
      stockByProduct.set(pid, (stockByProduct.get(pid) || 0) + Number(sl.quantity || 0))
    }

    const categoryStock: Record<string, number> = {}
    for (const p of (data as any).products) {
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
    logger.error('Error dashboard product-categories', error, {
      endpoint: '/api/dashboard/product-categories',
      method: 'GET',
    })
    return NextResponse.json(
      { error: 'Failed to fetch product categories', details: error?.message || String(error) },
      { status: 500 }
    )
  }
}
