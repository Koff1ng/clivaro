import { NextResponse } from 'next/server'
import { logger } from '@/lib/logger'
import { z } from 'zod'
import { requirePermission } from '@/lib/api-middleware'
import { PERMISSIONS } from '@/lib/permissions'
import { withTenantTx, getTenantIdFromSession } from '@/lib/tenancy'

export const dynamic = 'force-dynamic'

const schema = z.object({
  warehouseId: z.string().min(1),
  productId: z.string().min(1),
  variantId: z.string().optional().nullable(),
  minStock: z.number().min(0).default(0),
  maxStock: z.number().min(0).default(0),
})

export async function POST(request: Request) {
  const session = await requirePermission(request as any, PERMISSIONS.MANAGE_INVENTORY)
  if (session instanceof NextResponse) return session

  const tenantId = getTenantIdFromSession(session)

  try {
    const body = await request.json()
    const data = schema.parse(body)

    const result = await withTenantTx(tenantId, async (prisma) => {
      const where = {
        warehouseId: data.warehouseId,
        productId: data.productId,
        variantId: data.variantId ?? null,
      }

      const existing = await prisma.stockLevel.findFirst({
        where,
        select: { id: true },
      })

      if (existing) {
        return await prisma.stockLevel.update({
          where: { id: existing.id },
          data: { minStock: data.minStock, maxStock: data.maxStock },
        })
      } else {
        return await prisma.stockLevel.create({
          data: {
            warehouseId: data.warehouseId,
            productId: data.productId,
            variantId: data.variantId ?? null,
            quantity: 0,
            minStock: data.minStock,
            maxStock: data.maxStock,
          },
        })
      }
    })

    return NextResponse.json({ stockLevel: result })
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Error de validación', details: error.errors }, { status: 400 })
    }
    logger.error('Error updating stock level settings:', error)
    return NextResponse.json({ error: error.message || 'Failed to update settings' }, { status: 500 })
  }
}


