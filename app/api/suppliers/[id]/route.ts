import { NextResponse } from 'next/server'
import { logger } from '@/lib/logger'
import { requirePermission } from '@/lib/api-middleware'
import { PERMISSIONS } from '@/lib/permissions'
import { withTenantRead, withTenantTx, getTenantIdFromSession } from '@/lib/tenancy'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const updateSupplierSchema = z.object({
  name: z.string().min(1).optional(),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  address: z.string().optional(),
  taxId: z.string().optional(),
  notes: z.string().optional(),
  active: z.boolean().optional(),
})

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await requirePermission(request as any, PERMISSIONS.MANAGE_PURCHASES)
    if (session instanceof NextResponse) return session

    const tenantId = getTenantIdFromSession(session)

    const result = await withTenantRead(tenantId, async (prisma) => {
      const supplier = await prisma.supplier.findUnique({ where: { id: params.id } })
      if (!supplier) return null

      const purchaseOrders = await prisma.purchaseOrder.findMany({
        where: { supplierId: params.id },
        select: { id: true, number: true, status: true, total: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
      })

      const purchaseOrderIds = purchaseOrders.map(po => po.id)
      let allGoodsReceipts: any[] = []

      if (purchaseOrderIds.length > 0) {
        allGoodsReceipts = await prisma.goodsReceipt.findMany({
          where: { purchaseOrderId: { in: purchaseOrderIds } },
          include: {
            items: { select: { quantity: true, unitCost: true } },
          },
          orderBy: { createdAt: 'desc' },
        })
      }

      const goodsReceipts = allGoodsReceipts.map(gr => {
        const total = gr.items.reduce((sum: number, item: any) => sum + (item.quantity * item.unitCost), 0)
        return { id: gr.id, number: gr.number, total, createdAt: gr.createdAt }
      }).slice(0, 10)

      const totalPurchases = await prisma.purchaseOrder.aggregate({
        where: { supplierId: params.id, status: 'RECEIVED' },
        _sum: { total: true },
      })

      const receiptsTotal = allGoodsReceipts.reduce((sum, gr) => {
        const grTotal = gr.items.reduce((itemSum: number, item: any) => itemSum + (item.quantity * item.unitCost), 0)
        return sum + grTotal
      }, 0)

      return {
        supplier,
        statistics: {
          totalPurchases: totalPurchases._sum.total || 0,
          totalReceipts: receiptsTotal,
          ordersCount: purchaseOrders.length,
          receiptsCount: allGoodsReceipts.length,
        },
        recentOrders: purchaseOrders.slice(0, 10),
        recentReceipts: goodsReceipts,
      }
    })

    if (!result) return NextResponse.json({ error: 'Supplier not found' }, { status: 404 })

    return NextResponse.json(result)
  } catch (error: any) {
    logger.error('Error fetching supplier:', error)
    return NextResponse.json(
      {
        error: 'Failed to fetch supplier',
      },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await requirePermission(request as any, PERMISSIONS.MANAGE_PURCHASES)
  if (session instanceof NextResponse) return session

  const tenantId = getTenantIdFromSession(session)
  const user = session.user as any

  try {
    const body = await request.json()
    const data = updateSupplierSchema.parse(body)

    const supplier = await withTenantTx(tenantId, async (prisma) => {
      return await prisma.supplier.update({
        where: { id: params.id },
        data: {
          ...data,
          email: data.email !== undefined ? (data.email || null) : undefined,
          phone: data.phone !== undefined ? (data.phone || null) : undefined,
          address: data.address !== undefined ? (data.address || null) : undefined,
          taxId: data.taxId !== undefined ? (data.taxId || null) : undefined,
          notes: data.notes !== undefined ? (data.notes || null) : undefined,
          updatedById: user.id,
        },
      })
    })

    return NextResponse.json(supplier)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation error', details: error.errors }, { status: 400 })
    }
    logger.error('Error updating supplier:', error)
    return NextResponse.json({ error: 'Failed to update supplier' }, { status: 500 })
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await requirePermission(request as any, PERMISSIONS.MANAGE_PURCHASES)
  if (session instanceof NextResponse) return session

  const tenantId = getTenantIdFromSession(session)

  try {
    await withTenantTx(tenantId, async (prisma) => {
      await prisma.supplier.update({
        where: { id: params.id },
        data: { active: false },
      })
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    logger.error('Error deleting supplier:', error)
    return NextResponse.json({ error: 'Failed to delete supplier' }, { status: 500 })
  }
}
