import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/api-middleware'
import { PERMISSIONS } from '@/lib/permissions'
import { getPrismaForRequest } from '@/lib/get-tenant-prisma'
import { z } from 'zod'
import { toDecimal } from '@/lib/numbers'

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
  
  if (session instanceof NextResponse) {
    return session
  }

  // Obtener el cliente Prisma correcto (tenant o master según el usuario)
  const prisma = await getPrismaForRequest(request, session)

  try {
    const order = await prisma.purchaseOrder.findUnique({
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

    if (!order) {
      return NextResponse.json(
        { error: 'Purchase order not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(order)
  } catch (error) {
    console.error('Error fetching purchase order:', error)
    return NextResponse.json(
      { error: 'Failed to fetch purchase order' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await requirePermission(request as any, PERMISSIONS.MANAGE_PURCHASES)
  
  if (session instanceof NextResponse) {
    return session
  }

  // Obtener el cliente Prisma correcto (tenant o master según el usuario)
  const prisma = await getPrismaForRequest(request, session)

  try {
    const body = await request.json()
    const data = updatePurchaseOrderSchema.parse(body)

    // Check if order exists and can be edited
    const existingOrder = await prisma.purchaseOrder.findUnique({
      where: { id: params.id },
      include: {
        goodsReceipts: true,
      },
    })

    if (!existingOrder) {
      return NextResponse.json(
        { error: 'Purchase order not found' },
        { status: 404 }
      )
    }

    if (existingOrder.status === 'RECEIVED' && existingOrder.goodsReceipts.length > 0) {
      return NextResponse.json(
        { error: 'Cannot edit a received order with receipts' },
        { status: 400 }
      )
    }

    // If items are being updated, recalculate totals
    let updateData: any = {
      notes: data.notes !== undefined ? (data.notes || null) : undefined,
      updatedById: (session.user as any).id,
    }

    if (data.status) {
      updateData.status = data.status
    }

    if (data.supplierId) {
      updateData.supplierId = data.supplierId
    }

    if (data.expectedDate !== undefined) {
      updateData.expectedDate = data.expectedDate ? new Date(data.expectedDate) : null
    }

    if (data.items && data.items.length > 0) {
      // Recalculate totals
      let subtotal = 0
      const items: Array<{
        productId: string
        variantId: string | null
        quantity: number
        unitCost: number
        taxRate: number
        subtotal: number
      }> = []

      for (const item of data.items) {
        const itemSubtotal = toDecimal(item.quantity) * toDecimal(item.unitCost)
        const itemTax = itemSubtotal * (toDecimal(item.taxRate) / 100)
        const itemTotal = itemSubtotal + itemTax

        subtotal += itemSubtotal
        items.push({
          productId: item.productId,
          variantId: item.variantId || null,
          quantity: toDecimal(item.quantity),
          unitCost: toDecimal(item.unitCost),
          taxRate: toDecimal(item.taxRate),
          subtotal: itemTotal,
        })
      }

      const discount = toDecimal(data.discount || 0)
      const subtotalAfterDiscount = subtotal - discount
      const tax = items.reduce((sum, item) => {
        const itemSubtotal = item.quantity * item.unitCost
        return sum + (itemSubtotal * item.taxRate / 100)
      }, 0)
      const total = subtotalAfterDiscount + tax

      updateData.subtotal = subtotalAfterDiscount
      updateData.discount = discount
      updateData.tax = tax
      updateData.total = total

      // Use transaction to update items
      await prisma.$transaction(async (tx) => {
        // Delete existing items
        await tx.purchaseOrderItem.deleteMany({
          where: { purchaseOrderId: params.id },
        })

        // Update order with new totals
        await tx.purchaseOrder.update({
          where: { id: params.id },
          data: updateData,
        })

        // Create new items
        await tx.purchaseOrderItem.createMany({
          data: items.map(item => ({
            ...item,
            purchaseOrderId: params.id,
          })),
        })
      })

      // Fetch updated order
      const updatedOrder = await prisma.purchaseOrder.findUnique({
        where: { id: params.id },
        include: {
          supplier: true,
          items: {
            include: {
              product: true,
            },
          },
        },
      })

      return NextResponse.json(updatedOrder)
    } else {
      // Just update basic fields
      if (data.discount !== undefined) {
        // Recalculate totals with existing items
        const orderWithItems = await prisma.purchaseOrder.findUnique({
          where: { id: params.id },
          include: { items: true },
        })

        if (orderWithItems) {
          let subtotal = orderWithItems.items.reduce((sum, item) => sum + (item.quantity * item.unitCost), 0)
          const discount = data.discount || 0
          const subtotalAfterDiscount = subtotal - discount
          const tax = orderWithItems.items.reduce((sum, item) => {
            const itemSubtotal = item.quantity * item.unitCost
            return sum + (itemSubtotal * item.taxRate / 100)
          }, 0)
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

      return NextResponse.json(order)
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      )
    }
    console.error('Error updating purchase order:', error)
    return NextResponse.json(
      { error: 'Failed to update purchase order' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await requirePermission(request as any, PERMISSIONS.MANAGE_PURCHASES)
  
  if (session instanceof NextResponse) {
    return session
  }

  // Obtener el cliente Prisma correcto (tenant o master según el usuario)
  const prisma = await getPrismaForRequest(request, session)

  try {
    const order = await prisma.purchaseOrder.findUnique({
      where: { id: params.id },
    })

    if (!order) {
      return NextResponse.json(
        { error: 'Purchase order not found' },
        { status: 404 }
      )
    }

    if (order.status === 'RECEIVED') {
      return NextResponse.json(
        { error: 'Cannot delete a received order' },
        { status: 400 }
      )
    }

    await prisma.purchaseOrder.delete({
      where: { id: params.id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting purchase order:', error)
    return NextResponse.json(
      { error: 'Failed to delete purchase order' },
      { status: 500 }
    )
  }
}

