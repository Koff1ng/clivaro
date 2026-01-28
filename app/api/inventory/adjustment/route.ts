import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/api-middleware'
import { PERMISSIONS } from '@/lib/permissions'
import { getPrismaForRequest } from '@/lib/get-tenant-prisma'
import { z } from 'zod'
import { toDecimal } from '@/lib/numbers'
import { updateStockLevel } from '@/lib/inventory'
import { logActivity } from '@/lib/activity'

const adjustmentSchema = z.object({
  warehouseId: z.string(),
  productId: z.string().optional(),
  variantId: z.string().optional().nullable(),
  quantity: z.number(),
  reason: z.string().min(1),
  reasonCode: z.string().optional().nullable(),
  reasonNote: z.string().optional().nullable(),
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
    const data = adjustmentSchema.parse(body)

    if (!data.productId && !data.variantId) {
      return NextResponse.json(
        { error: 'Either productId or variantId is required' },
        { status: 400 }
      )
    }

    const quantity = data.quantity
    const movementType = quantity > 0 ? 'IN' : 'OUT'

    // Use transaction to ensure consistency
    await prisma.$transaction(async (tx) => {
      // Create stock movement
      await tx.stockMovement.create({
        data: {
          warehouseId: data.warehouseId,
          productId: data.productId || null,
          variantId: data.variantId || null,
          type: movementType,
          quantity: Math.abs(quantity),
          reason: data.reason,
          reasonCode: data.reasonCode as any,
          reasonNote: data.reasonNote,
          createdById: (session.user as any).id,
          reference: `ADJ-${Date.now()}`,
        },
      })

      // Update stock level - pasar el cliente de transacción
      await updateStockLevel(
        data.warehouseId,
        data.productId || null,
        data.variantId || null,
        quantity,
        tx // Pasar el cliente de transacción
      )

      // Audit Log
      await logActivity({
        prisma: tx,
        type: 'INVENTORY_ADJUSTMENT',
        subject: `Ajuste de inventario: ${data.reason}`,
        description: `${movementType === 'IN' ? 'Entrada' : 'Salida'} de ${Math.abs(quantity)} unidades.`,
        userId: (session.user as any).id,
        metadata: { warehouseId: data.warehouseId, productId: data.productId, variantId: data.variantId, quantity }
      })
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Error de validación', details: error.errors },
        { status: 400 }
      )
    }
    console.error('Error creating adjustment:', error)
    const errorMessage = error?.message || 'Error desconocido al crear ajuste'
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}

