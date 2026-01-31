import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/api-middleware'
import { PERMISSIONS } from '@/lib/permissions'
import { getPrismaForRequest } from '@/lib/get-tenant-prisma'
import { logger } from '@/lib/logger'

export async function GET(request: Request) {
  const session = await requirePermission(request as any, PERMISSIONS.MANAGE_SALES)

  if (session instanceof NextResponse) {
    return session
  }

  // Obtener el cliente Prisma correcto (tenant o master según el usuario)
  const prisma = await getPrismaForRequest(request, session)

  try {
    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search') || ''
    const category = searchParams.get('category') || ''
    const limit = parseInt(searchParams.get('limit') || '100')

    const where: any = {
      active: true,
      // HIDE INGREDIENTS FROM POS
      productType: { not: 'RAW' },
    }

    if (search) {
      where.OR = [
        { name: { contains: search } },
        { sku: { contains: search } },
        { barcode: { contains: search } },
      ]
    }

    if (category) {
      where.category = category
    }

    // Fetch all active warehouses to ensure we always return stock levels for all warehouses
    const allWarehouses = await prisma.warehouse.findMany({
      where: { active: true },
      select: { id: true },
    })
    const allWarehouseIds = allWarehouses.map(w => w.id)

    const productsRaw = await prisma.product.findMany({
      where,
      take: limit,
      orderBy: { name: 'asc' },
      include: {
        stockLevels: {
          select: {
            warehouseId: true,
            quantity: true,
          },
        },
        // Include recipe items to calculate virtual stock
        recipe: {
          include: {
            items: {
              include: {
                ingredient: {
                  select: {
                    id: true,
                    stockLevels: {
                      select: { quantity: true, warehouseId: true }
                    },
                  }
                }
              }
            }
          }
        }
      } as any,
    })

    // Process products to calculate virtual stock for recipe items
    const products = productsRaw.map((p: any) => {
      let stockLevels = p.stockLevels || []

      if (p.enableRecipeConsumption && p.recipe?.items?.length) {
        // For products with recipes, calculate virtual stock for ALL warehouses
        // (not just those with ingredient stock)
        const virtualStockLevels: any[] = []

        allWarehouseIds.forEach(warehouseId => {
          // Calculate max producible quantity for this warehouse
          const maxQuantities = p.recipe.items.map((item: any) => {
            if (!item.ingredient) return 0

            const sl = item.ingredient.stockLevels?.find((s: any) => s.warehouseId === warehouseId)
            const ingredientStock = sl?.quantity || 0

            if (item.quantity <= 0) return 0
            return Math.floor(ingredientStock / item.quantity)
          })

          const qty = maxQuantities.length > 0 ? Math.min(...maxQuantities) : 0

          // Always push the stock level for every warehouse, even if qty is 0
          // This ensures the product always has stockLevels populated
          virtualStockLevels.push({ warehouseId, quantity: qty })
        })

        // Use virtual stock for recipe products
        stockLevels = virtualStockLevels

        // Log for debugging (will be removed after verification)
        if (process.env.NODE_ENV === 'development') {
          logger.info(`Virtual stock calculated for ${p.name}`, { stockLevels })
        }
      }

      return {
        id: p.id,
        name: p.name,
        sku: p.sku,
        barcode: p.barcode,
        price: p.price,
        taxRate: p.taxRate,
        trackStock: p.trackStock,
        stockLevels: stockLevels,
        // category: p.category // optional if needed by POS
      }
    })

    return NextResponse.json({
      products,
    })
  } catch (error: any) {
    logger.error('Error fetching POS products', error, { endpoint: '/api/pos/products', method: 'GET' })
    return NextResponse.json(
      {
        error: error?.message || 'Failed to fetch products',
        code: 'SERVER_ERROR',
        details: process.env.NODE_ENV === 'development' ? String(error?.stack || '') : undefined,
      },
      { status: 500 }
    )
  }
}

