import { NextResponse } from 'next/server'
import { requireAnyPermission } from '@/lib/api-middleware'
import { PERMISSIONS } from '@/lib/permissions'
import { logger } from '@/lib/logger'
import { withTenantRead, getTenantIdFromSession } from '@/lib/tenancy'

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
    const category = searchParams.get('category') || ''
    const search = searchParams.get('search') || ''
    const skip = (page - 1) * limit

    const data = await withTenantRead(tenantId, async (prisma: any) => {
      // Build product-level where clause
      const productWhere: any = {
        active: true,
        trackStock: true,
      }

      if (category) {
        productWhere.category = category
      }

      if (search) {
        productWhere.OR = [
          { name: { contains: search, mode: 'insensitive' } },
          { sku: { contains: search, mode: 'insensitive' } },
          { barcode: { contains: search, mode: 'insensitive' } },
          { category: { contains: search, mode: 'insensitive' } },
        ]
      }

      // Get distinct categories for the filter dropdown
      const allProducts = await prisma.product.findMany({
        where: { active: true, trackStock: true },
        select: { category: true },
        distinct: ['category'],
      })
      const categories = allProducts
        .map((p: any) => p.category)
        .filter(Boolean)
        .sort()

      // Query products first (not stock levels), then include stock levels
      const [products, total] = await Promise.all([
        prisma.product.findMany({
          where: productWhere,
          skip,
          take: limit,
          include: {
            stockLevels: {
              include: {
                warehouse: true,
              },
              ...(warehouseId ? { where: { warehouseId } } : {}),
            },
          },
          orderBy: { name: 'asc' },
        }),
        prisma.product.count({ where: productWhere }),
      ])

      return { products, total, categories }
    })

    // Flatten: one row per product-warehouse combo
    // If a product has no stock levels, show it with 0 quantity
    const allStockLevels: any[] = []

    for (const product of data.products) {
      if (product.stockLevels && product.stockLevels.length > 0) {
        for (const sl of product.stockLevels) {
          allStockLevels.push({
            id: sl.id,
            productId: product.id,
            productName: product.name,
            productSku: product.sku,
            productBarcode: product.barcode,
            unitOfMeasure: product.unitOfMeasure || 'UNIT',
            warehouseId: sl.warehouseId,
            warehouseName: sl.warehouse?.name || 'Sin almacén',
            zoneName: 'General',
            quantity: sl.quantity,
            minStock: sl.minStock,
            maxStock: sl.maxStock ?? 0,
            isLowStock: sl.minStock > 0 && sl.quantity <= sl.minStock,
            trackStock: product.trackStock ?? true,
            cost: product.cost,
            price: product.price,
            category: product.category,
          })
        }
      } else {
        // Product has trackStock but no StockLevel record yet
        allStockLevels.push({
          id: `no-stock-${product.id}`,
          productId: product.id,
          productName: product.name,
          productSku: product.sku,
          productBarcode: product.barcode,
          unitOfMeasure: product.unitOfMeasure || 'UNIT',
          warehouseId: null,
          warehouseName: 'Sin asignar',
          zoneName: 'General',
          quantity: 0,
          minStock: 0,
          maxStock: 0,
          isLowStock: false,
          trackStock: product.trackStock ?? true,
          cost: product.cost,
          price: product.price,
          category: product.category,
        })
      }
    }

    return NextResponse.json({
      stockLevels: allStockLevels,
      categories: data.categories,
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
