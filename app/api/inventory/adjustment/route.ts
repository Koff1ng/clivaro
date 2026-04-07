import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/api-middleware'
import { PERMISSIONS } from '@/lib/permissions'
import { withTenantTx, getTenantIdFromSession } from '@/lib/tenancy'
import { z } from 'zod'
import { updateStockLevel } from '@/lib/inventory'
import { logActivity } from '@/lib/activity'
import { handleError } from '@/lib/error-handler'

export const dynamic = 'force-dynamic'

const adjustmentSchema = z.object({
  warehouseId: z.string().optional().nullable(),
  productId: z.string().optional().nullable(),
  variantId: z.string().optional().nullable(),
  quantity: z.number(),
  reason: z.string().min(1),
  reasonCode: z.string().optional().nullable(),
  reasonNote: z.string().optional().nullable(),
})

export async function POST(request: Request) {
  const session = await requirePermission(request as any, PERMISSIONS.MANAGE_INVENTORY)
  if (session instanceof NextResponse) return session

  const tenantId = getTenantIdFromSession(session)
  const user = session.user as any

  try {
    const body = await request.json()

    // Validate OUTSIDE the transaction
    const parsed = adjustmentSchema.safeParse(body)
    if (!parsed.success) {
      console.error('[ADJUSTMENT] Validation failed:', JSON.stringify(parsed.error.flatten()), 'Body:', JSON.stringify(body))
      return NextResponse.json(
        { error: 'Error de validación', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const data = parsed.data

    if (!data.productId && !data.variantId) {
      return NextResponse.json(
        { error: 'Se requiere productId o variantId' },
        { status: 400 }
      )
    }

    const result = await withTenantTx(tenantId, async (prisma) => {
      // Auto-resolve warehouseId if not provided
      let warehouseId = data.warehouseId
      if (!warehouseId) {
        const firstWarehouse = await prisma.warehouse.findFirst({
          where: { active: true },
          orderBy: { createdAt: 'asc' },
          select: { id: true },
        })
        if (!firstWarehouse) {
          throw new Error('NO_WAREHOUSE: No hay almacenes activos para asignar el inventario')
        }
        warehouseId = firstWarehouse.id
        console.log(`[ADJUSTMENT] Auto-resolved warehouse: ${warehouseId}`)
      }

      const quantity = data.quantity
      const movementType = quantity > 0 ? 'IN' : 'OUT'

      // Create stock movement
      await prisma.stockMovement.create({
        data: {
          warehouseId,
          productId: data.productId || null,
          variantId: data.variantId || null,
          type: movementType,
          quantity: Math.abs(quantity),
          reason: data.reason,
          reasonCode: data.reasonCode as any,
          reasonNote: data.reasonNote,
          createdById: user.id,
          reference: `ADJ-${Date.now()}`,
        },
      })

      // Update stock level
      await updateStockLevel(
        warehouseId,
        data.productId || null,
        data.variantId || null,
        quantity,
        prisma
      )

      // Audit Log
      await logActivity({
        prisma,
        type: 'INVENTORY_ADJUSTMENT',
        subject: `Ajuste de inventario: ${data.reason}`,
        description: `${movementType === 'IN' ? 'Entrada' : 'Salida'} de ${Math.abs(quantity)} unidades.`,
        userId: user.id,
        metadata: { warehouseId, productId: data.productId, variantId: data.variantId, quantity }
      })

      return { success: true }
    })

    return NextResponse.json(result)
  } catch (error: any) {
    console.error(`[INVENTORY_ADJUSTMENT_POST] Error:`, error?.message || error)

    if (error?.message?.startsWith('NO_WAREHOUSE')) {
      return NextResponse.json(
        { error: 'No hay almacenes activos para asignar el inventario' },
        { status: 400 }
      )
    }

    return handleError(error, 'INVENTORY_ADJUSTMENT_POST')
  }
}
