import { NextResponse } from 'next/server'
import { requireAnyPermission } from '@/lib/api-middleware'
import { PERMISSIONS } from '@/lib/permissions'
import { logger } from '@/lib/logger'
import { withTenantTx, getTenantIdFromSession } from '@/lib/tenancy'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const session = await requireAnyPermission(request as any, [PERMISSIONS.MANAGE_INVENTORY, PERMISSIONS.VIEW_REPORTS])
  if (session instanceof NextResponse) return session

  const tenantId = getTenantIdFromSession(session)

  try {
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const warehouseId = searchParams.get('warehouseId')
    const search = searchParams.get('search') || ''
    const skip = (page - 1) * limit

    const data = await withTenantTx(tenantId, async (tx: any) => {
      const stockLevelWhere: any = {
        product: {
          active: true,
          trackStock: true,
        },
      }

      if (warehouseId) {
        stockLevelWhere.warehouseId = warehouseId
      }

      if (search) {
        stockLevelWhere.product = {
          ...stockLevelWhere.product,
          OR: [
            { name: { contains: search, mode: 'insensitive' } },
            { sku: { contains: search, mode: 'insensitive' } },
            { barcode: { contains: search, mode: 'insensitive' } },
          ],
        }
      }

      const existingStockLevels = await tx.stockLevel.findMany({
        where: stockLevelWhere,
        include: {
          product: true,
          warehouse: true,
          zone: true,
        },
      })

      const total = await tx.stockLevel.count({ where: stockLevelWhere })

      return { existingStockLevels, total }
    })

    const allStockLevels = data.existingStockLevels.map((sl: any) => ({
      id: sl.id,
      productId: sl.productId,
      productName: sl.product?.name,
      productSku: sl.product?.sku,
      productBarcode: sl.product?.barcode,
      unitOfMeasure: sl.product?.unitOfMeasure || 'UND',
      warehouseId: sl.warehouseId,
      warehouseName: sl.warehouse?.name,
      zoneId: sl.zoneId,
      zoneName: sl.zone?.name || 'General',
      quantity: sl.quantity,
      minStock: sl.minStock,
      maxStock: sl.maxStock ?? 0,
      isLowStock: sl.quantity <= sl.minStock,
      trackStock: sl.product?.trackStock ?? true,
    }))

    const paginated = allStockLevels.slice(skip, skip + limit)

    return NextResponse.json({
      stockLevels: paginated,
      pagination: {
        page,
        limit,
        total: data.total,
        totalPages: Math.ceil(data.total / limit),
      },
    })
  } catch (error: any) {
    logger.error('Error fetching stock levels', error, { endpoint: '/api/inventory/stock-levels', method: 'GET' })
    return NextResponse.json(
      { error: 'Failed to fetch stock levels', details: error?.message || String(error) },
      { status: 500 }
    )
  }
}

