import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/api-middleware'
import { PERMISSIONS } from '@/lib/permissions'
import { getPrismaForRequest } from '@/lib/get-tenant-prisma'
import { z } from 'zod'
import { toDecimal } from '@/lib/numbers'
import { logger } from '@/lib/logger'
import { logActivity } from '@/lib/activity'

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
  // Variants (Upsert)
  variants: z.array(z.object({
    id: z.string().optional(), // If present, update. If missing, create.
    name: z.string().min(1),
    sku: z.string().optional().nullable(),
    barcode: z.string().optional().nullable(),
    price: z.number().min(0).optional(),
    cost: z.number().min(0).optional(),
  })).optional(),
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

    // Extract variants explicitly
    const { variants, minStock, maxStock, trackStock, ...directUpdateData } = data

    const updateData: any = {
      ...directUpdateData,
      updatedById: (session.user as any).id,
    }

    if (data.cost !== undefined) updateData.cost = data.cost
    if (data.price !== undefined) updateData.price = data.price
    if (data.taxRate !== undefined) updateData.taxRate = data.taxRate

    // Transaction for Update + Variants + Audit
    const product = await prisma.$transaction(async (tx) => {
      const p = await tx.product.update({
        where: { id: params.id },
        data: updateData,
      })

      // Handle Variants
      if (variants && variants.length > 0) {
        for (const v of variants) {
          if (v.id) {
            // Update existing
            await tx.productVariant.update({
              where: { id: v.id, productId: p.id }, // Security: enforce productId
              data: {
                name: v.name,
                sku: v.sku,
                barcode: v.barcode,
                price: v.price,
                cost: v.cost,
              }
            })
          } else {
            // Create new
            await tx.productVariant.create({
              data: {
                productId: p.id,
                name: v.name,
                sku: v.sku,
                barcode: v.barcode,
                price: v.price ?? p.price,
                cost: v.cost ?? p.cost,
              }
            })
          }
        }
      }

      // Handle Stock Levels (moved inside transaction)
      // Actualizar stock levels si se proporcionaron minStock o maxStock
      if (trackStock !== undefined || minStock !== undefined || maxStock !== undefined) {
        const warehouse = await tx.warehouse.findFirst({
          where: { active: true },
          orderBy: { createdAt: 'asc' },
        })

        if (warehouse) {
          const existing = await tx.stockLevel.findFirst({
            where: {
              warehouseId: warehouse.id,
              productId: p.id,
              variantId: null,
            },
            select: { id: true },
          })

          // Si trackStock está desactivado, eliminar el stock level
          if (trackStock === false) {
            if (existing) {
              await tx.stockLevel.delete({
                where: { id: existing.id },
              })
            }
          } else {
            // Si trackStock está activado o no se especificó, actualizar/crear stock level
            const minStockVal = minStock !== undefined && !isNaN(Number(minStock))
              ? Number(minStock)
              : existing
                ? undefined // Mantener el valor existente si no se proporciona
                : 0

            const maxStockVal = maxStock !== undefined && maxStock !== null && !isNaN(Number(maxStock)) && Number(maxStock) > 0
              ? Number(maxStock)
              : maxStock === null || (maxStock === 0 && maxStock !== undefined)
                ? 0 // 0 significa sin máximo configurado
                : undefined // Mantener el valor existente si no se proporciona

            const stockData: any = {}
            if (minStockVal !== undefined) stockData.minStock = minStockVal
            if (maxStockVal !== undefined) stockData.maxStock = maxStockVal

            if (existing) {
              if (Object.keys(stockData).length > 0) {
                await tx.stockLevel.update({
                  where: { id: existing.id },
                  data: stockData,
                })
              }
            } else {
              await tx.stockLevel.create({
                data: {
                  warehouseId: warehouse.id,
                  productId: p.id,
                  variantId: null,
                  quantity: 0,
                  minStock: minStockVal ?? 0,
                  maxStock: maxStockVal ?? 0,
                },
              })
            }
          }
        }
      }

      // Audit Log
      await logActivity({
        prisma: tx,
        type: 'PRODUCT_UPDATE',
        subject: `Producto actualizado: ${p.name}`,
        description: `Actualizado por usuario. ${variants ? `Variantes procesadas: ${variants.length}` : ''}`,
        userId: (session.user as any).id,
        metadata: { productId: p.id, updates: Object.keys(directUpdateData) }
      })

      return p
    })

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
    await prisma.$transaction(async (tx) => {
      const p = await tx.product.update({
        where: { id: params.id },
        data: {
          active: false,
          updatedById: (session.user as any).id,
        },
      })

      await logActivity({
        prisma: tx,
        type: 'PRODUCT_DELETE',
        subject: `Producto eliminado (soft): ${p.name}`,
        description: `El producto fue marcado como inactivo.`,
        userId: (session.user as any).id,
        metadata: { productId: p.id, sku: p.sku }
      })
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

