import { NextResponse } from 'next/server'
import { requirePermission, requireAnyPermission } from '@/lib/api-middleware'
import { PERMISSIONS } from '@/lib/permissions'
import { getPrismaForRequest } from '@/lib/get-tenant-prisma'
import { z } from 'zod'
import { toDecimal } from '@/lib/numbers'

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
})

export async function GET(request: Request) {
  // Allow both MANAGE_PRODUCTS and MANAGE_SALES (for POS cashiers)
  const session = await requireAnyPermission(request as any, [PERMISSIONS.MANAGE_PRODUCTS, PERMISSIONS.MANAGE_SALES])
  
  if (session instanceof NextResponse) {
    return session
  }

  // Obtener el cliente Prisma correcto (tenant o master según el usuario)
  const prisma = await getPrismaForRequest(request, session)

  try {
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const search = searchParams.get('search') || ''
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

    // Determinar ordenamiento
    let orderByClause: any = { name: 'asc' }
    if (orderBy === 'createdAt') {
      orderByClause = { createdAt: 'desc' }
    } else if (orderBy === 'name') {
      orderByClause = { name: 'asc' }
    }

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        skip,
        take: limit,
        orderBy: orderByClause,
        include: {
          _count: {
            select: { variants: true },
          },
        },
      }),
      prisma.product.count({ where }),
    ])

    return NextResponse.json({
      products: products.map(p => ({
        ...p,
        cost: p.cost,
        price: p.price,
        taxRate: p.taxRate,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error('Error fetching products:', error)
    return NextResponse.json(
      { error: 'Failed to fetch products' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  const session = await requirePermission(request as any, PERMISSIONS.MANAGE_PRODUCTS)
  
  if (session instanceof NextResponse) {
    return session
  }

  // Obtener el cliente Prisma correcto (tenant o master según el usuario)
  const prisma = await getPrismaForRequest(request, session)

  let requestBody: any = null
  try {
    requestBody = await request.json()
    const data = createProductSchema.parse(requestBody)

    // Extraer minStock y maxStock antes de crear el producto (no son campos del modelo Product)
    const { minStock, maxStock, ...productData } = data

    const product = await prisma.product.create({
      data: {
        ...productData,
        cost: productData.cost,
        price: productData.price,
        taxRate: productData.taxRate,
        barcode: productData.barcode || null,
        brand: productData.brand || null,
        category: productData.category && productData.category.trim() !== '' ? productData.category.trim() : null,
        description: productData.description || null,
        createdById: (session.user as any).id,
      },
    })

    // Create/update stock settings for default warehouse
    if (data.trackStock) {
      const warehouse = await prisma.warehouse.findFirst({
        where: { active: true },
        orderBy: { createdAt: 'asc' },
      })
      if (warehouse) {
        // Prisma does not allow `null` in compound-unique `where` for upsert in some generated types.
        // Use findFirst + update/create to safely handle variantId = null.
        const existing = await prisma.stockLevel.findFirst({
          where: {
            warehouseId: warehouse.id,
            productId: product.id,
            variantId: null,
          },
          select: { id: true },
        })

        // Asegurar que minStock y maxStock sean números válidos
        // minStock es requerido si trackStock es true
        const minStockValue = minStock !== undefined && minStock !== null && !isNaN(Number(minStock)) 
          ? Number(minStock) 
          : 0 // Default a 0 si no se proporciona
        
        // maxStock es opcional: si está vacío, undefined o null, usar 0 (sin máximo configurado)
        const maxStockValue = maxStock !== undefined && maxStock !== null && !isNaN(Number(maxStock)) && Number(maxStock) > 0 
          ? Number(maxStock) 
          : 0 // 0 significa sin máximo configurado

        if (existing) {
          await prisma.stockLevel.update({
            where: { id: existing.id },
            data: {
              minStock: minStockValue,
              maxStock: maxStockValue,
            },
          })
        } else {
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
        }
      }
    }

    return NextResponse.json(product, { status: 201 })
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      )
    }
    
    // Log detailed error information
    const errorMessage = error instanceof Error ? error.message : String(error)
    const errorStack = error instanceof Error ? error.stack : undefined
    const errorName = error instanceof Error ? error.name : 'Unknown'
    const errorCode = error?.code || error?.meta?.code || undefined
    
    // Check for Prisma unique constraint violations
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
      name: errorName,
      code: errorCode,
      stack: errorStack,
      body: requestBody,
      prismaError: error,
    })
    
    return NextResponse.json(
      { 
        error: 'Failed to create product',
        details: errorMessage,
        name: errorName,
        code: errorCode,
      },
      { status: 500 }
    )
  }
}

