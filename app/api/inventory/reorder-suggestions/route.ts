import { NextResponse } from 'next/server'
import { requireAnyPermission } from '@/lib/api-middleware'
import { PERMISSIONS } from '@/lib/permissions'
import { getPrismaForRequest } from '@/lib/get-tenant-prisma'

export async function GET(request: Request) {
  const session = await requireAnyPermission(request as any, [PERMISSIONS.MANAGE_INVENTORY, PERMISSIONS.MANAGE_PURCHASES, PERMISSIONS.VIEW_REPORTS])
  if (session instanceof NextResponse) return session

  const prisma = await getPrismaForRequest(request, session)

  try {
    const { searchParams } = new URL(request.url)
    const warehouseId = searchParams.get('warehouseId') || ''
    const q = (searchParams.get('q') || '').trim()

    const where: any = {
      OR: [
        { minStock: { gt: 0 } },
        { maxStock: { gt: 0 } },
      ],
    }
    if (warehouseId) where.warehouseId = warehouseId

    const levels = await prisma.stockLevel.findMany({
      where,
      include: {
        product: { select: { id: true, name: true, sku: true, trackStock: true } },
        warehouse: { select: { id: true, name: true } },
      },
      orderBy: [{ warehouseId: 'asc' }, { updatedAt: 'desc' }],
      take: 500,
    })

    const suggestions = levels
      .filter((sl: any) => sl.product?.trackStock)
      .map((sl: any) => {
        const min = Number(sl.minStock || 0)
        const max = Number(sl.maxStock || 0)
        const qty = Number(sl.quantity || 0)
        const target = max > 0 ? max : min
        const suggested = Math.max(0, target - qty)
        const needs = min > 0 ? qty <= min : suggested > 0
        return {
          id: sl.id,
          warehouseId: sl.warehouseId,
          warehouseName: sl.warehouse?.name || '',
          productId: sl.productId,
          productName: sl.product?.name || 'Unknown',
          productSku: sl.product?.sku || '',
          quantity: qty,
          minStock: min,
          maxStock: max,
          targetStock: target,
          suggestedQty: suggested,
          needsReorder: needs,
        }
      })
      .filter((s: any) => s.needsReorder && s.suggestedQty > 0)
      .filter((s: any) => {
        if (!q) return true
        const hay = `${s.productName} ${s.productSku} ${s.warehouseName}`.toLowerCase()
        return hay.includes(q.toLowerCase())
      })
      .sort((a: any, b: any) => b.suggestedQty - a.suggestedQty)

    return NextResponse.json({ suggestions })
  } catch (error) {
    console.error('Error fetching reorder suggestions:', error)
    return NextResponse.json({ error: 'Failed to fetch reorder suggestions' }, { status: 500 })
  }
}


