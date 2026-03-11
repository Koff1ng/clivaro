import { NextResponse } from 'next/server'
import { requireAnyPermission } from '@/lib/api-middleware'
import { PERMISSIONS } from '@/lib/permissions'
import { withTenantRead, getTenantIdFromSession } from '@/lib/tenancy'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const session = await requireAnyPermission(request as any, [PERMISSIONS.MANAGE_INVENTORY, PERMISSIONS.VIEW_REPORTS])
  if (session instanceof NextResponse) return session

  const tenantId = getTenantIdFromSession(session)
  if (!tenantId) return NextResponse.json([])

  try {
    const stockLevels = await withTenantRead(tenantId, async (prisma) => {
      return prisma.stockLevel.findMany({
        where: { product: { active: true, trackStock: true } },
        include: { product: true, warehouse: true },
      })
    })

    const lowStockItems = (stockLevels as any[])
      .filter(item => item.minStock != null && item.minStock > 0 && item.quantity <= item.minStock)
      .slice(0, 20)
      .map(item => ({
        id: item.id,
        productName: item.product?.name || 'Unknown',
        warehouseName: item.warehouse?.name || 'N/A',
        quantity: item.quantity,
        minStock: item.minStock,
      }))

    return NextResponse.json(lowStockItems)
  } catch (error: any) {
    logger.error('Error fetching low stock', error, { endpoint: '/api/inventory/low-stock' })
    return NextResponse.json([])
  }
}
