import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getPrismaForRequest } from '@/lib/get-tenant-prisma'
import { requireAnyPermission } from '@/lib/api-middleware'
import { PERMISSIONS } from '@/lib/permissions'
import { logger } from '@/lib/logger'

const stockCheckSchema = z.object({
  warehouseId: z.string().min(1),
  items: z.array(z.object({
    productId: z.string().min(1),
    variantId: z.string().optional().nullable(),
  })).min(1).max(50),
})

function keyOf(productId: string, variantId?: string | null) {
  return `${productId}::${variantId || ''}`
}

export async function POST(request: Request) {
  const session = await requireAnyPermission(request as any, [PERMISSIONS.MANAGE_INVENTORY, PERMISSIONS.MANAGE_SALES])
  if (session instanceof NextResponse) return session

  const prisma = await getPrismaForRequest(request, session)

  try {
    const body = await request.json()
    const data = stockCheckSchema.parse(body)

    const ors = data.items.map((it) => ({
      productId: it.productId,
      variantId: it.variantId || null,
      warehouseId: data.warehouseId,
    }))

    const rows = await prisma.stockLevel.findMany({
      where: { OR: ors },
      select: { productId: true, variantId: true, quantity: true },
    })

    const map: Record<string, number> = {}
    for (const it of data.items) {
      map[keyOf(it.productId, it.variantId)] = 0
    }
    for (const r of rows) {
      if (!r.productId) continue
      map[keyOf(r.productId, r.variantId)] = Number(r.quantity || 0)
    }

    return NextResponse.json({ stock: map }, { status: 200 })
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Error de validación', code: 'VALIDATION_ERROR', details: error.errors }, { status: 400 })
    }
    logger.error('Error stock-check', error, { endpoint: '/api/inventory/stock-check', method: 'POST' })
    return NextResponse.json({ error: error?.message || 'Error al consultar stock', code: 'SERVER_ERROR' }, { status: 500 })
  }
}


