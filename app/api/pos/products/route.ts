import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/api-middleware'
import { PERMISSIONS } from '@/lib/permissions'
import { withTenantRead } from '@/lib/tenancy'
import { logger } from '@/lib/logger'

export async function GET(request: Request) {
  const session = await requirePermission(request as any, PERMISSIONS.MANAGE_SALES)

  if (session instanceof NextResponse) {
    return session
  }

  const tenantId = (session.user as any).tenantId

  if (!tenantId) {
    return NextResponse.json({ error: 'Tenant context required' }, { status: 403 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search') || ''
    const category = searchParams.get('category') || ''
    const limit = parseInt(searchParams.get('limit') || '100')

    const result = await withTenantRead(tenantId, async (prisma) => {
      const where: any = {
        active: true,
        productType: { not: 'RAW' },
      }

      if (search) {
        where.OR = [
          { name: { contains: search, mode: 'insensitive' } },
          { sku: { contains: search, mode: 'insensitive' } },
          { barcode: { contains: search, mode: 'insensitive' } },
        ]
      }

      if (category) {
        where.category = category
      }

      const allWarehouses = await prisma.warehouse.findMany({
        where: { active: true },
        select: { id: true },
      })
      const allWarehouseIds = allWarehouses.map((w: any) => w.id)

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

      // Fetch unit conversions for all products
      const allUnits = await prisma.unit.findMany()
      const unitMap = new Map(allUnits.map((u: any) => [u.id, u]))

      const unitConversions = await prisma.unitConversion.findMany()

      // Build conversion map: for each unit symbol, list available sale units
      const conversionsBySymbol = new Map<string, Array<{ unitSymbol: string, unitName: string, multiplier: number }>>()
      for (const conv of unitConversions as any[]) {
        const fromUnit = unitMap.get(conv.fromUnitId)
        const toUnit = unitMap.get(conv.toUnitId)
        if (!fromUnit || !toUnit) continue

        const fromSymbol = (fromUnit as any).symbol
        if (!conversionsBySymbol.has(fromSymbol)) {
          conversionsBySymbol.set(fromSymbol, [])
        }
        conversionsBySymbol.get(fromSymbol)!.push({
          unitSymbol: (toUnit as any).symbol,
          unitName: (toUnit as any).name,
          multiplier: conv.multiplier as number,
        })
      }

      const products = productsRaw.map((p: any) => {
        let stockLevels = p.stockLevels || []

        if (p.enableRecipeConsumption && p.recipe?.items?.length) {
          const virtualStockLevels: any[] = []

          allWarehouseIds.forEach((warehouseId: string) => {
            const maxQuantities = p.recipe.items.map((item: any) => {
              if (!item.ingredient) return 0
              const sl = item.ingredient.stockLevels?.find((s: any) => s.warehouseId === warehouseId)
              const ingredientStock = sl?.quantity || 0
              if (item.quantity <= 0) return 0
              return Math.floor(ingredientStock / item.quantity)
            })
            const qty = maxQuantities.length > 0 ? Math.min(...maxQuantities) : 0
            virtualStockLevels.push({ warehouseId, quantity: qty })
          })
          stockLevels = virtualStockLevels
        }

        // Get available sale units for this product
        const saleUnits = conversionsBySymbol.get(p.unitOfMeasure) || []

        return {
          id: p.id,
          name: p.name,
          sku: p.sku,
          barcode: p.barcode,
          price: p.price,
          taxRate: p.taxRate,
          trackStock: p.trackStock,
          unitOfMeasure: p.unitOfMeasure,
          category: p.category,
          stockLevels: stockLevels,
          // Fractional unit sales: available units to sell individually
          saleUnits: saleUnits.length > 0 ? saleUnits.map(su => ({
            unitSymbol: su.unitSymbol,
            unitName: su.unitName,
            multiplier: su.multiplier,
            // Price per individual unit = bulk price / multiplier
            unitPrice: Math.round((p.price / su.multiplier) * 100) / 100,
          })) : [],
        }
      })

      return { products }
    })

    return NextResponse.json(result)
  } catch (error: any) {
    logger.error('Error fetching POS products', error, { endpoint: '/api/pos/products', method: 'GET' })
    return NextResponse.json(
      {
        error: error?.message || 'Failed to fetch products',
        code: 'SERVER_ERROR',
      },
      { status: 500 }
    )
  }
}

