import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/api-middleware'
import { PERMISSIONS } from '@/lib/permissions'
import { getPrismaForRequest } from '@/lib/get-tenant-prisma'
import { z } from 'zod'
import { toDecimal } from '@/lib/numbers'
import { updateStockLevel, checkStock } from '@/lib/inventory'

const transferSchema = z.object({
  fromWarehouseId: z.string(),
  toWarehouseId: z.string(),
  productId: z.string().optional(),
  variantId: z.string().optional().nullable(),
  quantity: z.number().positive(),
  reason: z.string().optional(),
})

export async function POST(request: Request) {
  const session = await requirePermission(request as any, PERMISSIONS.MANAGE_INVENTORY)
  
  if (session instanceof NextResponse) {
    return session
  }

  // Obtener el cliente Prisma correcto (tenant o master según el usuario)
  const prisma = await getPrismaForRequest(request, session)

  try {
    const body = await request.json()
    const data = transferSchema.parse(body)

    if (data.fromWarehouseId === data.toWarehouseId) {
      return NextResponse.json(
        { error: 'Source and destination warehouses must be different' },
        { status: 400 }
      )
    }

    if (!data.productId && !data.variantId) {
      return NextResponse.json(
        { error: 'Either productId or variantId is required' },
        { status: 400 }
      )
    }

    const quantity = data.quantity

    // Check stock availability
    const hasStock = await checkStock(
      data.fromWarehouseId,
      data.productId!,
      data.variantId || null,
      quantity
    )

    if (!hasStock) {
      return NextResponse.json(
        { error: 'Insufficient stock in source warehouse' },
        { status: 400 }
      )
    }

    // Use transaction
    await prisma.$transaction(async (tx) => {
      // Create OUT movement from source
      await tx.stockMovement.create({
        data: {
          warehouseId: data.fromWarehouseId,
          productId: data.productId || null,
          variantId: data.variantId || null,
          type: 'OUT',
          quantity,
          reason: data.reason || 'Transfer',
          createdById: (session.user as any).id,
          reference: `TRF-${Date.now()}`,
        },
      })

      // Create IN movement to destination
      await tx.stockMovement.create({
        data: {
          warehouseId: data.toWarehouseId,
          productId: data.productId || null,
          variantId: data.variantId || null,
          type: 'IN',
          quantity,
          reason: data.reason || 'Transfer',
          createdById: (session.user as any).id,
          reference: `TRF-${Date.now()}`,
        },
      })

      // Update stock levels
      await updateStockLevel(
        data.fromWarehouseId,
        data.productId || null,
        data.variantId || null,
        -quantity
      )

      await updateStockLevel(
        data.toWarehouseId,
        data.productId || null,
        data.variantId || null,
        quantity
      )
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      )
    }
    console.error('Error creating transfer:', error)
    return NextResponse.json(
      { error: 'Failed to create transfer' },
      { status: 500 }
    )
  }
}

