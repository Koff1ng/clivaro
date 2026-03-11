import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/api-middleware'
import { PERMISSIONS } from '@/lib/permissions'
import { withTenantTx, getTenantIdFromSession } from '@/lib/tenancy'
import { z } from 'zod'
import { updateStockLevel } from '@/lib/inventory'
import { logActivity } from '@/lib/activity'
import { handleError } from '@/lib/error-handler'

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
  if (session instanceof NextResponse) return session

  const tenantId = getTenantIdFromSession(session)
  const user = session.user as any

  try {
    const body = await request.json()
    const result = await withTenantTx(tenantId, async (prisma) => {
      const parsed = adjustmentSchema.safeParse(body)
      if (!parsed.success) {
        return { error: 'Error de validación', details: parsed.error.flatten(), status: 400 }
      }
      const data = parsed.data

      if (!data.productId && !data.variantId) {
        return { error: 'Either productId or variantId is required', status: 400 }
      }

      const quantity = data.quantity
      const movementType = quantity > 0 ? 'IN' : 'OUT'

      // Create stock movement
      await prisma.stockMovement.create({
        data: {
          warehouseId: data.warehouseId,
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
        data.warehouseId,
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
        metadata: { warehouseId: data.warehouseId, productId: data.productId, variantId: data.variantId, quantity }
      })

      return { success: true }
    })

    if ('error' in result) {
      return NextResponse.json({ error: result.error, details: result.details }, { status: result.status })
    }

    return NextResponse.json(result)
  } catch (error: unknown) {
    return handleError(error, 'INVENTORY_ADJUSTMENT_POST')
  }
}

