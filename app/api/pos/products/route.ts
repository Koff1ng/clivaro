import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/api-middleware'
import { PERMISSIONS } from '@/lib/permissions'
import { prisma as masterPrisma } from '@/lib/db'
import { withTenantTx } from '@/lib/tenancy'
import { logger } from '@/lib/logger'

export async function GET(request: Request) {
  const session = await requirePermission(request as any, PERMISSIONS.MANAGE_SALES)

  if (session instanceof NextResponse) {
    return session
  }

  const tenantId = (session.user as any).tenantId
  const isSuperAdmin = (session.user as any).isSuperAdmin

  const productsCallback = async (prisma: any) => {
    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search') || ''
    const category = searchParams.get('category') || ''
    const limit = parseInt(searchParams.get('limit') || '100')

    const where: any = {
      active: true,
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

      return {
        id: p.id,
        name: p.name,
        sku: p.sku,
        barcode: p.barcode,
        price: p.price,
        taxRate: p.taxRate,
        trackStock: p.trackStock,
        stockLevels: stockLevels,
      }
    })

    return products
  }

  try {
    let products
    if (isSuperAdmin && !tenantId) {
      // Super admins view global products (public)
      products = await productsCallback(masterPrisma)
    } else {
      // Regular users and tenant admins use isolated schema
      if (!tenantId) {
        throw new Error('Tenant context missing')
      }
      products = await withTenantTx(tenantId, productsCallback)
    }

    return NextResponse.json({ products })
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

