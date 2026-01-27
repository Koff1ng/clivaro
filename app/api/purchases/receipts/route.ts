import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/api-middleware'
import { PERMISSIONS } from '@/lib/permissions'
import { getPrismaForRequest } from '@/lib/get-tenant-prisma'
import { logger } from '@/lib/logger'
import { z } from 'zod'
import { toDecimal } from '@/lib/numbers'
import { updateStockLevel, updateProductCost } from '@/lib/inventory'
import { logActivity } from '@/lib/activity'

const createReceiptSchema = z.object({
  purchaseOrderId: z.string(),
  warehouseId: z.string(),
  items: z.array(z.object({
    productId: z.string(),
    variantId: z.string().optional().nullable(),
    quantity: z.number().positive(),
    unitCost: z.number().min(0),
    purchaseOrderItemId: z.string().optional(),
  })),
  notes: z.string().optional(),
})

export async function GET(request: Request) {
  const session = await requirePermission(request as any, PERMISSIONS.MANAGE_PURCHASES)

  if (session instanceof NextResponse) {
    return session
  }

  // Obtener el cliente Prisma correcto (tenant o master según el usuario)
  const prisma = await getPrismaForRequest(request, session)

  try {
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const search = searchParams.get('search') || ''
    const purchaseOrderId = searchParams.get('purchaseOrderId')
    const skip = (page - 1) * limit

    const where: any = {}

    if (search) {
      where.OR = [
        { number: { contains: search } },
        { purchaseOrder: { number: { contains: search } } },
      ]
    }

    if (purchaseOrderId) {
      where.purchaseOrderId = purchaseOrderId
    }

    const [receipts, total] = await Promise.all([
      prisma.goodsReceipt.findMany({
        where,
        skip,
        take: limit,
        include: {
          purchaseOrder: {
            select: {
              id: true,
              number: true,
              supplier: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
          warehouse: {
            select: {
              id: true,
              name: true,
            },
          },
          items: {
            include: {
              product: {
                select: {
                  id: true,
                  name: true,
                  sku: true,
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.goodsReceipt.count({ where }),
    ])

    // Calculate totals for each receipt
    const receiptsWithTotals = receipts.map(receipt => {
      const total = receipt.items.reduce((sum, item) => sum + (item.quantity * item.unitCost), 0)
      return {
        ...receipt,
        total,
      }
    })

    return NextResponse.json({
      receipts: receiptsWithTotals,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    logger.error('Error fetching receipts', error, { endpoint: '/api/purchases/receipts', method: 'GET' })
    return NextResponse.json(
      { error: 'Failed to fetch receipts' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  const session = await requirePermission(request as any, PERMISSIONS.MANAGE_PURCHASES)

  if (session instanceof NextResponse) {
    return session
  }

  // Obtener el cliente Prisma correcto (tenant o master según el usuario)
  const prisma = await getPrismaForRequest(request, session)

  try {
    const body = await request.json()
    const data = createReceiptSchema.parse(body)

    // Get purchase order to validate
    const purchaseOrder = await prisma.purchaseOrder.findUnique({
      where: { id: data.purchaseOrderId },
      include: {
        items: true,
      },
    })

    if (!purchaseOrder) {
      return NextResponse.json(
        { error: 'Purchase order not found' },
        { status: 404 }
      )
    }

    // Use transaction
    const receipt = await prisma.$transaction(async (tx) => {
      // Create goods receipt
      const receiptCount = await tx.goodsReceipt.count()
      const receiptNumber = `GR-${String(receiptCount + 1).padStart(6, '0')}`

      const receipt = await tx.goodsReceipt.create({
        data: {
          number: receiptNumber,
          purchaseOrderId: data.purchaseOrderId,
          warehouseId: data.warehouseId,
          notes: data.notes || null,
          createdById: (session.user as any).id,
          items: {
            create: data.items.map(item => ({
              productId: item.productId,
              variantId: item.variantId || null,
              quantity: toDecimal(item.quantity),
              unitCost: toDecimal(item.unitCost),
              purchaseOrderItemId: item.purchaseOrderItemId || null,
            })),
          },
        },
      })

      // Update stock levels and product costs
      for (const item of data.items) {
        const quantity = toDecimal(item.quantity)
        const unitCost = toDecimal(item.unitCost)

        logger.debug('[Goods Receipt] Processing item', { productId: item.productId, quantity: Number(quantity) })

        // Create IN stock movement
        await tx.stockMovement.create({
          data: {
            warehouseId: data.warehouseId,
            productId: item.productId,
            variantId: item.variantId || null,
            type: 'IN',
            quantity: quantity,
            reason: `Recepción de compra - ${receiptNumber}`,
            createdById: (session.user as any).id,
            reference: receiptNumber,
          },
        })
        logger.debug('[Goods Receipt] Stock movement created')

        // Update stock level directly in transaction (more reliable)
        const whereClause: any = {
          warehouseId: data.warehouseId,
          productId: item.productId,
          variantId: item.variantId || null,
        }

        const existingStock = await tx.stockLevel.findFirst({
          where: whereClause,
        })

        if (existingStock) {
          const newQuantity = existingStock.quantity + quantity
          logger.debug('[Goods Receipt] Updating existing stock', { from: existingStock.quantity, delta: Number(quantity), to: newQuantity })
          await tx.stockLevel.update({
            where: { id: existingStock.id },
            data: { quantity: newQuantity },
          })
          logger.debug('[Goods Receipt] Stock updated')
        } else {
          // No existe registro, crear uno nuevo
          logger.debug('[Goods Receipt] Creating stock record', { quantity: Number(quantity) })
          await tx.stockLevel.create({
            data: {
              warehouseId: data.warehouseId,
              productId: item.productId,
              variantId: item.variantId || null,
              quantity: quantity,
              minStock: 0,
            },
          })
          logger.debug('[Goods Receipt] Stock record created')
        }

        // Update product cost (moving average) (using transaction client)
        await updateProductCost(
          item.productId,
          data.warehouseId,
          quantity,
          unitCost,
          tx
        )

        // Verificar que el stock se actualizó
        const updatedStock = await tx.stockLevel.findFirst({
          where: whereClause,
        })
        logger.debug('[Goods Receipt] Stock verified', { productId: item.productId, quantity: updatedStock?.quantity || 0 })
      }

      // Update purchase order status if all items received
      const po = await tx.purchaseOrder.findUnique({
        where: { id: data.purchaseOrderId },
        include: {
          items: true,
          goodsReceipts: {
            include: {
              items: true,
            },
          },
        },
      })

      if (po) {
        // Check if all items are received (simplified check)
        const totalOrdered = po.items.reduce((sum, item) => sum + item.quantity, 0)
        const totalReceived = po.goodsReceipts.reduce((sum, gr) => {
          return sum + gr.items.reduce((sum2, item) => sum2 + item.quantity, 0)
        }, 0)

        if (totalReceived >= totalOrdered) {
          await tx.purchaseOrder.update({
            where: { id: data.purchaseOrderId },
            data: { status: 'RECEIVED' },
          })
        } else {
          await tx.purchaseOrder.update({
            where: { id: data.purchaseOrderId },
            data: { status: 'SENT' },
          })
        }
      }
      return receipt
    })



    // Audit Log
    await logActivity({
      prisma,
      type: 'PURCHASE_RECEIPT',
      subject: `Recepción de mercancía: ${receipt.number}`,
      userId: (session.user as any).id,
      metadata: {
        receiptId: receipt.id,
        receiptNumber: receipt.number,
        purchaseOrderId: data.purchaseOrderId
      }
    })

    return NextResponse.json({ success: true }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      )
    }
    logger.error('Error creating receipt', error, { endpoint: '/api/purchases/receipts', method: 'POST' })
    return NextResponse.json(
      { error: 'Failed to create receipt' },
      { status: 500 }
    )
  }
}
