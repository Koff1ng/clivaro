import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/api-middleware'
import { PERMISSIONS } from '@/lib/permissions'
import { getPrismaForRequest } from '@/lib/get-tenant-prisma'
import { z } from 'zod'
import { toDecimal } from '@/lib/numbers'

const updateProductSchema = z.object({
  sku: z.string().min(1).optional(),
  barcode: z.string().optional().nullable(),
  name: z.string().min(1).optional(),
  brand: z.string().optional().nullable(),
  category: z.string().optional().nullable(),
  unitOfMeasure: z.enum(['UNIT', 'BOX', 'METER', 'KILO', 'LITER']).optional(),
  cost: z.number().min(0).optional(),
  price: z.number().min(0).optional(),
  taxRate: z.number().min(0).max(100).optional(),
  trackStock: z.boolean().optional(),
  minStock: z.number().min(0).optional(),
  maxStock: z.number().min(0).optional().nullable(),
  description: z.string().optional().nullable(),
  active: z.boolean().optional(),
})

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await requirePermission(request as any, PERMISSIONS.MANAGE_PRODUCTS)
  
  if (session instanceof NextResponse) {
    return session
  }

  // Obtener el cliente Prisma correcto (tenant o master según el usuario)
  const prisma = await getPrismaForRequest(request, session)

  try {
    const product = await prisma.product.findUnique({
      where: { id: params.id },
      include: {
        variants: true,
        stockLevels: {
          include: {
            warehouse: true,
          },
        },
      },
    })

    if (!product) {
      return NextResponse.json(
        { error: 'Product not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      ...product,
      cost: product.cost,
      price: product.price,
      taxRate: product.taxRate,
      stockLevels: product.stockLevels.map(sl => ({
        ...sl,
        quantity: sl.quantity,
        minStock: sl.minStock,
      })),
    })
  } catch (error) {
    console.error('Error fetching product:', error)
    return NextResponse.json(
      { error: 'Failed to fetch product' },
      { status: 500 }
    )
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await requirePermission(request as any, PERMISSIONS.MANAGE_PRODUCTS)
  
  if (session instanceof NextResponse) {
    return session
  }

  // Obtener el cliente Prisma correcto (tenant o master según el usuario)
  const prisma = await getPrismaForRequest(request, session)

  try {
    const body = await request.json()
    const data = updateProductSchema.parse(body)

    const updateData: any = {
      ...data,
      updatedById: (session.user as any).id,
    }

    if (data.cost !== undefined) {
      updateData.cost = data.cost
    }
    if (data.price !== undefined) {
      updateData.price = data.price
    }
    if (data.taxRate !== undefined) {
      updateData.taxRate = data.taxRate
    }

    const product = await prisma.product.update({
      where: { id: params.id },
      data: updateData,
    })

    // Actualizar stock levels si se proporcionaron minStock o maxStock
    if (data.trackStock !== undefined || data.minStock !== undefined || data.maxStock !== undefined) {
      const warehouse = await prisma.warehouse.findFirst({
        where: { active: true },
        orderBy: { createdAt: 'asc' },
      })
      
      if (warehouse) {
        const existing = await prisma.stockLevel.findFirst({
          where: {
            warehouseId: warehouse.id,
            productId: product.id,
            variantId: null,
          },
          select: { id: true },
        })

        // Si trackStock está desactivado, eliminar el stock level
        if (data.trackStock === false) {
          if (existing) {
            await prisma.stockLevel.delete({
              where: { id: existing.id },
            })
          }
        } else {
          // Si trackStock está activado o no se especificó, actualizar/crear stock level
          const minStock = data.minStock !== undefined && !isNaN(Number(data.minStock)) 
            ? Number(data.minStock) 
            : existing 
              ? undefined // Mantener el valor existente si no se proporciona
              : 0
          
          const maxStock = data.maxStock !== undefined && data.maxStock !== null && !isNaN(Number(data.maxStock)) && Number(data.maxStock) > 0
            ? Number(data.maxStock)
            : data.maxStock === null || (data.maxStock === 0 && data.maxStock !== undefined)
              ? 0 // 0 significa sin máximo configurado
              : undefined // Mantener el valor existente si no se proporciona

          const stockData: any = {}
          if (minStock !== undefined) stockData.minStock = minStock
          if (maxStock !== undefined) stockData.maxStock = maxStock

          if (existing) {
            if (Object.keys(stockData).length > 0) {
              await prisma.stockLevel.update({
                where: { id: existing.id },
                data: stockData,
              })
            }
          } else {
            await prisma.stockLevel.create({
              data: {
                warehouseId: warehouse.id,
                productId: product.id,
                variantId: null,
                quantity: 0,
                minStock: minStock ?? 0,
                maxStock: maxStock ?? 0,
              },
            })
          }
        }
      }
    }

    return NextResponse.json(product)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      )
    }
    console.error('Error updating product:', error)
    return NextResponse.json(
      { error: 'Failed to update product' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await requirePermission(request as any, PERMISSIONS.MANAGE_PRODUCTS)
  
  if (session instanceof NextResponse) {
    return session
  }

  // Obtener el cliente Prisma correcto (tenant o master según el usuario)
  const prisma = await getPrismaForRequest(request, session)

  try {
    await prisma.product.update({
      where: { id: params.id },
      data: {
        active: false,
        updatedById: (session.user as any).id,
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting product:', error)
    return NextResponse.json(
      { error: 'Failed to delete product' },
      { status: 500 }
    )
  }
}

