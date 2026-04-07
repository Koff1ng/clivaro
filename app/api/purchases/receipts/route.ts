import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/api-middleware'
import { PERMISSIONS } from '@/lib/permissions'
import { withTenantRead, withTenantTx } from '@/lib/tenancy'
import { logger } from '@/lib/logger'
import { z } from 'zod'
import { toDecimal } from '@/lib/numbers'
import { updateStockLevel, updateProductCost } from '@/lib/inventory'
import { logActivity } from '@/lib/activity'

export const dynamic = 'force-dynamic'

const createReceiptSchema = z.object({
  purchaseOrderId: z.string().min(1, "El ID de la orden de compra es requerido"),
  warehouseId: z.string().min(1, "El almacén es requerido"),
  items: z.array(z.object({
    productId: z.string().min(1, "El ID del producto es requerido"),
    variantId: z.string().optional().nullable(),
    quantity: z.number().positive("La cantidad debe ser mayor a 0"),
    unitCost: z.number().min(0, "El costo unitario no puede ser negativo"),
    purchaseOrderItemId: z.string().optional().nullable(),
  })).min(1, "La recepción debe tener al menos un ítem"),
  notes: z.string().optional().nullable(),
})

type CreateReceiptInput = z.infer<typeof createReceiptSchema>

export async function GET(request: Request) {
  const session = await requirePermission(request as any, PERMISSIONS.MANAGE_PURCHASES)

  if (session instanceof NextResponse) {
    return session
  }

  const tenantId = (session.user as any).tenantId

  try {
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const search = searchParams.get('search') || ''
    const purchaseOrderId = searchParams.get('purchaseOrderId')
    const skip = (page - 1) * limit

    const result = await withTenantRead(tenantId, async (prisma) => {
      const where: any = {}

      if (search) {
        where.OR = [
          { number: { contains: search, mode: 'insensitive' } },
          { purchaseOrder: { number: { contains: search, mode: 'insensitive' } } },
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

      return {
        receipts: receiptsWithTotals,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      }
    })

    return NextResponse.json(result)
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

  const tenantId = (session.user as any).tenantId

  try {
    const body = await request.json()
    const parseResult = createReceiptSchema.safeParse(body)

    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Error de validación', details: parseResult.error.flatten() },
        { status: 400 }
      )
    }

    const data: CreateReceiptInput = parseResult.data

    const result = await withTenantTx(tenantId, async (prisma) => {
      // Get purchase order to validate
      const purchaseOrder = await prisma.purchaseOrder.findUnique({
        where: { id: data.purchaseOrderId },
        include: {
          items: true,
        },
      })

      if (!purchaseOrder) {
        throw new Error('Purchase order not found')
      }

      // Create goods receipt
      const receiptCount = await prisma.goodsReceipt.count()
      const receiptNumber = `GR-${String(receiptCount + 1).padStart(6, '0')}`

      const receipt = await prisma.goodsReceipt.create({
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

        logger.debug('[Goods Receipt] Processing item', { productId: item.productId, quantity: Number(quantity) })

        // Create IN stock movement
        await prisma.stockMovement.create({
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

        // Update stock level atomicly
        await updateStockLevel(
          data.warehouseId,
          item.productId,
          item.variantId || null,
          quantity,
          prisma
        )

        // Update product cost (moving average)
        await updateProductCost(
          item.productId,
          data.warehouseId,
          quantity,
          toDecimal(item.unitCost),
          prisma,
          item.variantId
        )
      }

      // INTEGRACIÓN CONTABLE: Registrar entrada a inventario
      const totalCost = data.items.reduce((sum: number, item: any) => sum + (item.quantity * item.unitCost), 0)

      try {
        const { createInventoryPurchaseEntry } = await import('@/lib/accounting/inventory-integration')
        await createInventoryPurchaseEntry(
          receipt.id,
          tenantId || 'public',
          (session.user as any).id,
          totalCost,
          purchaseOrder.supplierId,
          undefined,
          undefined,
          prisma
        )
      } catch (accError: any) {
        logger.error('Error in accounting integration during purchase receipt', accError)
        throw new Error(`Error en integración contable de compra: ${accError.message}`)
      }

      // Update purchase order status if all items received
      const po = await prisma.purchaseOrder.findUnique({
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
        const totalOrdered = po.items.reduce((sum: number, item: any) => sum + item.quantity, 0)
        const totalReceived = po.goodsReceipts.reduce((sum: number, gr: any) => {
          return sum + gr.items.reduce((sum2: number, item: any) => sum2 + item.quantity, 0)
        }, 0)

        if (totalReceived >= totalOrdered) {
          await prisma.purchaseOrder.update({
            where: { id: data.purchaseOrderId },
            data: { status: 'RECEIVED' },
          })
        } else {
          await prisma.purchaseOrder.update({
            where: { id: data.purchaseOrderId },
            data: { status: 'SENT' },
          })
        }
      }

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

      return receipt
    })

    return NextResponse.json({ success: true }, { status: 201 })
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      )
    }
    logger.error('Error creating receipt', error, { endpoint: '/api/purchases/receipts', method: 'POST' })
    return NextResponse.json(
      { error: error.message || 'Failed to create receipt' },
      { status: 500 }
    )
  }
}
