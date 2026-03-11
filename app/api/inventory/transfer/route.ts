import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/api-middleware'
import { PERMISSIONS } from '@/lib/permissions'
import { withTenantTx, getTenantIdFromSession } from '@/lib/tenancy'
import { z } from 'zod'
import { updateStockLevel, checkStock } from '@/lib/inventory'
import { handleError } from '@/lib/error-handler'

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
  if (session instanceof NextResponse) return session

  const tenantId = getTenantIdFromSession(session)

  try {
    const body = await request.json()
    const result = await withTenantTx(tenantId, async (tx) => {
      const parsed = transferSchema.safeParse(body)
      if (!parsed.success) {
        return { error: 'Validation error', details: parsed.error.flatten(), status: 400 }
      }
      const data = parsed.data

      if (data.fromWarehouseId === data.toWarehouseId) {
        return { error: 'Source and destination warehouses must be different', status: 400 }
      }

      if (!data.productId && !data.variantId) {
        return { error: 'Either productId or variantId is required', status: 400 }
      }

      const quantity = data.quantity

      // Check stock availability within transaction
      const hasStock = await checkStock(
        data.fromWarehouseId,
        data.productId!,
        data.variantId || null,
        quantity,
        tx // Pass transaction client
      )

      if (!hasStock) {
        throw new Error('Insufficient stock in source warehouse')
      }

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

      // Update stock levels within transaction
      await updateStockLevel(
        data.fromWarehouseId,
        data.productId || null,
        data.variantId || null,
        -quantity,
        tx // Pass transaction client
      )

      await updateStockLevel(
        data.toWarehouseId,
        data.productId || null,
        data.variantId || null,
        quantity,
        tx // Pass transaction client
      )

      return { success: true }
    })

    if ('error' in result) {
      return NextResponse.json({ error: result.error, details: result.details }, { status: result.status })
    }

    return NextResponse.json(result)
  } catch (error: unknown) {
    return handleError(error, 'INVENTORY_TRANSFER_POST')
  }
}
