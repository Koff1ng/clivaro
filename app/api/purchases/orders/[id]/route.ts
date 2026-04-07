import { NextResponse } from 'next/server'
import { logger } from '@/lib/logger'
import { requirePermission } from '@/lib/api-middleware'
import { PERMISSIONS } from '@/lib/permissions'
import { withTenantRead, withTenantTx, getTenantIdFromSession } from '@/lib/tenancy'
import { z } from 'zod'
import { parseDateOnlyToDate } from '@/lib/date-only'
import { toDecimal } from '@/lib/numbers'
import { logActivity } from '@/lib/activity'

export const dynamic = 'force-dynamic'

const updatePurchaseOrderSchema = z.object({
  supplierId: z.string().min(1).optional(),
  items: z.array(z.object({
    productId: z.string(),
    variantId: z.string().optional().nullable(),
    quantity: z.number().min(0.01),
    unitCost: z.number().min(0),
    taxRate: z.number().min(0).max(100).default(0),
  })).optional(),
  discount: z.number().min(0).default(0).optional(),
  expectedDate: z.string().optional().nullable(),
  status: z.enum(['DRAFT', 'SENT', 'RECEIVED', 'CANCELLED']).optional(),
  notes: z.string().optional(),
})

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await requirePermission(request as any, PERMISSIONS.MANAGE_PURCHASES)
  if (session instanceof NextResponse) return session

  const tenantId = getTenantIdFromSession(session)

  try {
    const order = await withTenantRead(tenantId, async (prisma) => {
      return await prisma.purchaseOrder.findUnique({
        where: { id: params.id },
        include: {
          supplier: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
              address: true,
              taxId: true,
            },
          },
          items: {
            include: {
              product: {
                select: {
                  id: true,
                  name: true,
                  sku: true,
                  price: true,
                },
              },
              variant: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
          goodsReceipts: {
            select: {
              id: true,
              number: true,
              receivedAt: true,
              createdAt: true,
            },
            orderBy: { createdAt: 'desc' },
          },
        },
      })
    })

    if (!order) {
      return NextResponse.json({ error: 'Purchase order not found' }, { status: 404 })
    }

    return NextResponse.json(order)
  } catch (error) {
    logger.error('Error fetching purchase order:', error)
    return NextResponse.json({ error: 'Failed to fetch purchase order' }, { status: 500 })
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
    const data = updatePurchaseOrderSchema.parse(body)

    const resultOrder = await withTenantTx(tenantId, async (prisma) => {
      const existingOrder = await prisma.purchaseOrder.findUnique({
        where: { id: params.id },
        include: { goodsReceipts: true },
      })

      if (!existingOrder) {
        throw new Error('Purchase order not found')
      }

      if (existingOrder.status === 'RECEIVED' && existingOrder.goodsReceipts.length > 0) {
        throw new Error('Cannot edit a received order with receipts')
      }

      let updateData: any = {
        notes: data.notes !== undefined ? (data.notes || null) : undefined,
        updatedById: user.id,
      }

      if (data.status) updateData.status = data.status
      if (data.supplierId) updateData.supplierId = data.supplierId
      if (data.expectedDate !== undefined) updateData.expectedDate = parseDateOnlyToDate(data.expectedDate)

      if (data.items && data.items.length > 0) {
        let subtotal = 0
        const itemsToCreate: Array<any> = []

        for (const item of data.items) {
          const itemSubtotal = toDecimal(item.quantity) * toDecimal(item.unitCost)
          const itemTax = itemSubtotal * (toDecimal(item.taxRate) / 100)
          const itemTotal = itemSubtotal + itemTax

          subtotal += itemSubtotal
          itemsToCreate.push({
            productId: item.productId,
            variantId: item.variantId || null,
            quantity: toDecimal(item.quantity),
            unitCost: toDecimal(item.unitCost),
            taxRate: toDecimal(item.taxRate),
            subtotal: itemTotal,
            purchaseOrderId: params.id,
          })
        }

        const discount = toDecimal(data.discount || 0)
        const subtotalAfterDiscount = subtotal - discount
        const tax = itemsToCreate.reduce((sum, item) => sum + (item.quantity * item.unitCost * item.taxRate / 100), 0)
        const total = subtotalAfterDiscount + tax

        updateData.subtotal = subtotalAfterDiscount
        updateData.discount = discount
        updateData.tax = tax
        updateData.total = total

        await prisma.purchaseOrderItem.deleteMany({ where: { purchaseOrderId: params.id } })
        await prisma.purchaseOrder.update({ where: { id: params.id }, data: updateData })
        await prisma.purchaseOrderItem.createMany({ data: itemsToCreate })

        await logActivity({
          prisma,
          type: 'PURCHASE_ORDER_UPDATE',
          subject: `Orden de Compra actualizada: ${params.id}`,
          userId: user.id,
          metadata: { orderId: params.id, updates: { items: data.items.length, status: data.status, notes: data.notes } }
        })

        return await prisma.purchaseOrder.findUnique({
          where: { id: params.id },
          include: { supplier: true, items: { include: { product: true } } },
        })
      } else {
        if (data.discount !== undefined) {
          const orderWithItems = await prisma.purchaseOrder.findUnique({
            where: { id: params.id },
            include: { items: true },
          })

          if (orderWithItems) {
            let subtotal = orderWithItems.items.reduce((sum, item) => sum + (item.quantity * item.unitCost), 0)
            const discount = data.discount || 0
            const subtotalAfterDiscount = subtotal - discount
            const tax = orderWithItems.items.reduce((sum, item) => sum + (item.quantity * item.unitCost * item.taxRate / 100), 0)
            const total = subtotalAfterDiscount + tax

            updateData.subtotal = subtotalAfterDiscount
            updateData.discount = discount
            updateData.tax = tax
            updateData.total = total
          }
        }

        const order = await prisma.purchaseOrder.update({
          where: { id: params.id },
          data: updateData,
        })

        await logActivity({
          prisma,
          type: 'PURCHASE_ORDER_UPDATE',
          subject: `Orden de Compra actualizada: ${params.id}`,
          userId: user.id,
          metadata: { orderId: params.id, updates: { discount: data.discount, status: data.status, notes: data.notes } }
        })

        return order
      }
    })

    return NextResponse.json(resultOrder)
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation error', details: error.errors }, { status: 400 })
    }
    if (error.message === 'Purchase order not found') {
      return NextResponse.json({ error: error.message }, { status: 404 })
    }
    if (error.message === 'Cannot edit a received order with receipts') {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    logger.error('Error updating purchase order:', error)
    return NextResponse.json({ error: 'Failed to update purchase order' }, { status: 500 })
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await requirePermission(request as any, PERMISSIONS.MANAGE_PURCHASES)
  if (session instanceof NextResponse) return session

  const tenantId = getTenantIdFromSession(session)
  const user = session.user as any

  try {
    await withTenantTx(tenantId, async (prisma) => {
      const order = await prisma.purchaseOrder.findUnique({ where: { id: params.id } })
      if (!order) throw new Error('Purchase order not found')
      if (order.status === 'RECEIVED') throw new Error('Cannot delete a received order')

      await prisma.purchaseOrder.delete({ where: { id: params.id } })

      await logActivity({
        prisma,
        type: 'PURCHASE_ORDER_DELETE',
        subject: `Orden de Compra eliminada: ${order.number}`,
        userId: user.id,
        metadata: { orderId: params.id, orderNumber: order.number }
      })
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    if (error.message === 'Purchase order not found') {
      return NextResponse.json({ error: error.message }, { status: 404 })
    }
    if (error.message === 'Cannot delete a received order') {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    logger.error('Error deleting purchase order:', error)
    return NextResponse.json({ error: 'Failed to delete purchase order' }, { status: 500 })
  }
}

