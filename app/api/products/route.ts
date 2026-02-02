import { NextResponse } from 'next/server'
import { requirePermission, requireAnyPermission } from '@/lib/api-middleware'
import { PERMISSIONS } from '@/lib/permissions'
import { withTenantTx } from '@/lib/tenancy'
import { z } from 'zod'
import { toDecimal } from '@/lib/numbers'
import { logger } from '@/lib/logger'
import { logActivity } from '@/lib/activity'

// Función helper para ejecutar consultas con retry y manejo de errores de conexión
async function executeWithRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  delay = 1000
): Promise<T> {
  let lastError: any
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error: any) {
      lastError = error
      const errorMessage = error?.message || String(error)

      // Si es error de límite de conexiones, esperar y reintentar
      if (errorMessage.includes('MaxClientsInSessionMode') || errorMessage.includes('max clients reached')) {
        if (attempt < maxRetries - 1) {
          const backoffDelay = Math.min(delay * Math.pow(2, attempt), 10000) // Backoff exponencial, max 10s
          logger.warn(`[Products] Límite de conexiones alcanzado, reintentando en ${backoffDelay}ms (intento ${attempt + 1}/${maxRetries})`)
          await new Promise(resolve => setTimeout(resolve, backoffDelay))
          continue
        }
      }

      // Si no es error de conexión, lanzar inmediatamente
      throw error
    }
  }
  throw lastError
}

const createProductSchema = z.object({
  sku: z.string().min(1),
  barcode: z.string().optional().nullable(),
  name: z.string().min(1),
  brand: z.string().optional().nullable(),
  category: z.string().optional().nullable(),
  unitOfMeasure: z.enum(['UNIT', 'BOX', 'METER', 'KILO', 'LITER']),
  cost: z.number().min(0),
  price: z.number().min(0),
  taxRate: z.number().min(0).max(100),
  trackStock: z.boolean().default(true),
  minStock: z.union([z.number().min(0), z.undefined()]).optional(),
  maxStock: z.union([z.number().min(0), z.null(), z.undefined()]).optional().nullable(),
  description: z.string().optional().nullable(),
  productType: z.enum(['RETAIL', 'RAW', 'PREPARED', 'SELLABLE']).default('RETAIL'),
  enableRecipeConsumption: z.boolean().default(false),
  printerStation: z.enum(['KITCHEN', 'BAR', 'CASHIER']).optional().nullable(),
  // Variants
  variants: z.array(z.object({
    name: z.string().min(1),
    sku: z.string().optional().nullable(),
    barcode: z.string().optional().nullable(),
    price: z.number().min(0).optional(),
    cost: z.number().min(0).optional(),
  })).optional(),
})

export async function GET(request: Request) {
  // Allow both MANAGE_PRODUCTS and MANAGE_SALES (for POS cashiers)
  const session = await requireAnyPermission(request as any, [PERMISSIONS.MANAGE_PRODUCTS, PERMISSIONS.MANAGE_SALES])

  if (session instanceof NextResponse) {
    return session
  }

  const tenantId = session.user.tenantId

  try {
    return await withTenantTx(tenantId, async (prisma) => {
      const { searchParams } = new URL(request.url)
      const page = parseInt(searchParams.get('page') || '1')
      const limit = parseInt(searchParams.get('limit') || '20')
      const search = searchParams.get('search') || ''
      const category = searchParams.get('category') || ''
      const productType = searchParams.get('productType') || ''
      const orderBy = searchParams.get('orderBy') || 'name'
      const skip = (page - 1) * limit

      const where: any = {
        active: true,
      }

      if (search) {
        where.OR = [
          { name: { contains: search } },
          { sku: { contains: search } },
          { barcode: { contains: search } },
        ]
      }

      // Add Category Filter
      if (category && category !== 'all') {
        where.category = category
      }

      // Add ProductType Filter
      if (productType && productType !== 'all') {
        where.productType = productType
      }

      // Add hasRecipe Filter
      const hasRecipe = searchParams.get('hasRecipe')
      if (hasRecipe === 'true') {
        where.enableRecipeConsumption = true
      } else if (hasRecipe === 'false') {
        where.enableRecipeConsumption = false
      }

      // Determinar ordenamiento
      let orderByClause: any = { name: 'asc' }
      if (orderBy === 'createdAt') {
        orderByClause = { createdAt: 'desc' }
      } else if (orderBy === 'name') {
        orderByClause = { name: 'asc' }
      }

      const [productsRaw, total] = await Promise.all([
        executeWithRetry(() => prisma.product.findMany({
          where,
          skip,
          take: limit,
          orderBy: orderByClause,
          include: {
            _count: {
              select: { variants: true },
            },
            stockLevels: {
              select: { quantity: true, warehouseId: true }
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
                        unitOfMeasure: true
                      }
                    }
                  }
                }
              }
            }
          } as any,
        })),
        executeWithRetry(() => prisma.product.count({ where })),
      ])

      // Explicitly cast or handle the type safely
      const productsWithStock = productsRaw.map((p: any) => {
        let stock = 0

        if (p.enableRecipeConsumption && p.recipe?.items?.length) {
          // Calculate virtual stock based on ingredients
          const maxQuantities = p.recipe.items.map((item: any) => {
            if (!item.ingredient) return 0

            // Total ingredient stock across all warehouses (simplified for now)
            const ingredientStock = item.ingredient.stockLevels?.reduce((sum: number, sl: any) => sum + sl.quantity, 0) || 0

            if (item.quantity <= 0) return 0
            return Math.floor(ingredientStock / item.quantity)
          })

          stock = maxQuantities.length > 0 ? Math.min(...maxQuantities) : 0

        } else {
          // Standard physical stock
          stock = p.stockLevels?.reduce((sum: number, sl: any) => sum + sl.quantity, 0) || 0
        }

        return {
          ...p,
          cost: p.cost,
          price: p.price,
          taxRate: p.taxRate,
          stock, // Return the calculated stock
          // Clean up internal relations to keep response light if needed, or leave them
          recipe: undefined,
          stockLevels: undefined
        }
      })

      return NextResponse.json({
        products: productsWithStock,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      })
    })
  } catch (error) {
    console.error('Error fetching products:', error)
    return NextResponse.json(
      {
        error: 'Failed to fetch products',
        details: error instanceof Error ? error.message : String(error),
        code: (error as any)?.code
      },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  const session = await requirePermission(request as any, PERMISSIONS.MANAGE_PRODUCTS)

  if (session instanceof NextResponse) {
    return session
  }

  const tenantId = session.user.tenantId
  let requestBody: any = null

  try {
    requestBody = await request.json()
    const data = createProductSchema.parse(requestBody)

    return await withTenantTx(tenantId, async (prisma) => {
      // Extraer minStock y maxStock antes de crear el producto (no son campos del modelo Product)
      const { minStock, maxStock, variants, ...productData } = data

      // Use the provided transaction context (prisma) for product + variants + audit
      const product = await prisma.product.create({
        data: {
          ...productData,
          productType: data.productType as any,
          enableRecipeConsumption: data.enableRecipeConsumption as any,
          cost: productData.cost,
          price: productData.price,
          taxRate: productData.taxRate,
          barcode: productData.barcode || null,
          brand: productData.brand || null,
          category: productData.category && productData.category.trim() !== '' ? productData.category.trim() : null,
          description: productData.description || null,
          createdById: (session.user as any).id,
          variants: variants && variants.length > 0 ? {
            create: variants.map(v => ({
              name: v.name,
              sku: v.sku || undefined, // Allow Prisma to handle null/undefined if unique
              barcode: v.barcode || null,
              price: v.price ?? productData.price, // Inherit if not set
              cost: v.cost ?? productData.cost,     // Inherit if not set
            }))
          } : undefined
        },
        include: {
          variants: true
        }
      })

      // Log activity
      await logActivity({
        prisma: prisma, // Use the same transaction context
        type: 'PRODUCT_CREATE',
        subject: `Producto creado: ${product.name}`,
        description: `Creado con SKU: ${product.sku}. ${variants?.length ? `Con ${variants.length} variantes.` : ''}`,
        userId: (session.user as any).id,
        metadata: { productId: product.id, sku: product.sku, variantsCount: variants?.length }
      })

      // Create/update stock settings for default warehouse
      if (data.trackStock) {
        const warehouse = await prisma.warehouse.findFirst({
          where: { active: true },
          orderBy: { createdAt: 'asc' },
        })
        if (warehouse) {
          const minStockValue = minStock !== undefined && minStock !== null && !isNaN(Number(minStock))
            ? Number(minStock)
            : 0

          const maxStockValue = maxStock !== undefined && maxStock !== null && !isNaN(Number(maxStock)) && Number(maxStock) > 0
            ? Number(maxStock)
            : 0

          // Crear stock para el producto principal
          await prisma.stockLevel.create({
            data: {
              warehouseId: warehouse.id,
              productId: product.id,
              variantId: null,
              quantity: 0,
              minStock: minStockValue,
              maxStock: maxStockValue,
            },
          })

          // También crear stock para variantes si existen
          if (product.variants && product.variants.length > 0) {
            for (const v of product.variants) {
              await prisma.stockLevel.create({
                data: {
                  warehouseId: warehouse.id,
                  productId: product.id,
                  variantId: v.id,
                  quantity: 0,
                  minStock: minStockValue,
                  maxStock: maxStockValue,
                }
              })
            }
          }
        }
      }

      return NextResponse.json(product, { status: 201 })
    })

  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      )
    }

    const errorMessage = error instanceof Error ? error.message : String(error)
    const errorCode = error?.code || error?.meta?.code || undefined

    if (error?.code === 'P2002') {
      const target = error?.meta?.target
      let field = 'campo'
      if (Array.isArray(target)) {
        field = target[0] || 'campo'
      }
      return NextResponse.json(
        {
          error: 'Error de validación',
          details: `Ya existe un producto con este ${field === 'sku' ? 'SKU' : field === 'barcode' ? 'código de barras' : field}`,
          code: errorCode,
        },
        { status: 400 }
      )
    }

    console.error('Error creating product:', {
      error: errorMessage,
      body: requestBody,
    })

    return NextResponse.json(
      {
        error: 'Failed to create product',
        details: errorMessage,
        code: errorCode,
      },
      { status: 500 }
    )
  }
}

