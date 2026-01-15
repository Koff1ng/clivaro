import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/api-middleware'
import { PERMISSIONS } from '@/lib/permissions'
import { getPrismaForRequest } from '@/lib/get-tenant-prisma'
import { updateStockLevel } from '@/lib/inventory'
import { z } from 'zod'

const convertQuotationSchema = z.object({
  paymentMethod: z.enum(['CASH', 'CARD', 'TRANSFER', 'CHECK']).default('CASH'),
  warehouseId: z.string().optional(),
})

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await requirePermission(request as any, PERMISSIONS.MANAGE_SALES)
  
  if (session instanceof NextResponse) {
    return session
  }

  // Obtener el cliente Prisma correcto (tenant o master según el usuario)
  const prisma = await getPrismaForRequest(request, session)

  try {
    const body = await request.json().catch(() => ({}))
    const { paymentMethod = 'CASH', warehouseId } = convertQuotationSchema.parse(body)

    const quotation = await prisma.quotation.findUnique({
      where: { id: params.id },
      include: {
        items: {
          include: {
            product: true,
          },
        },
        customer: true,
      },
    })

    if (!quotation) {
      return NextResponse.json(
        { error: 'Cotización no encontrada' },
        { status: 404 }
      )
    }

    if (quotation.status === 'ACCEPTED') {
      return NextResponse.json(
        { error: 'La cotización ya fue aceptada' },
        { status: 400 }
      )
    }

    // Get default warehouse if not provided
    let finalWarehouseId = warehouseId
    if (!finalWarehouseId) {
      const warehouse = await prisma.warehouse.findFirst({
        where: { active: true },
      })
      if (!warehouse) {
        return NextResponse.json(
          { error: 'No hay almacén disponible' },
          { status: 400 }
        )
      }
      finalWarehouseId = warehouse.id
    }

    // Use transaction to create invoice directly from quotation
    const result = await prisma.$transaction(async (tx) => {
      // Create invoice directly
      const invoiceCount = await tx.invoice.count()
      const prefix = process.env.BILLING_RESOLUTION_PREFIX || 'FV'
      const consecutive = String(invoiceCount + 1).padStart(6, '0')
      const invoiceNumber = `${prefix}-${consecutive}`

      const invoice = await tx.invoice.create({
        data: {
          number: invoiceNumber,
          prefix: prefix,
          consecutive: consecutive,
          customerId: quotation.customerId,
          status: 'PAGADA', // Estado en español
          subtotal: quotation.subtotal,
          discount: quotation.discount,
          tax: quotation.tax,
          total: quotation.total,
          notes: quotation.notes,
          issuedAt: new Date(),
          paidAt: new Date(),
          electronicStatus: 'PENDING',
          createdById: (session.user as any).id,
          items: {
            create: quotation.items.map(item => ({
              productId: item.productId,
              variantId: item.variantId || null,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              discount: item.discount,
              taxRate: item.taxRate,
              subtotal: item.subtotal,
            })),
          },
        },
      })

      // Create payment
      await tx.payment.create({
        data: {
          invoiceId: invoice.id,
          amount: quotation.total,
          method: paymentMethod,
          createdById: (session.user as any).id,
        },
      })

      // Create stock movements for tracked products
      for (const item of quotation.items) {
        const product = await tx.product.findUnique({
          where: { id: item.productId },
        })

        if (product?.trackStock) {
          // Create OUT movement
          await tx.stockMovement.create({
            data: {
              warehouseId: finalWarehouseId,
              productId: item.productId,
              variantId: item.variantId || null,
              type: 'OUT',
              quantity: item.quantity,
              reason: 'Invoice from Quotation',
              createdById: (session.user as any).id,
              reference: invoiceNumber,
            },
          })

          // Update stock level
          await updateStockLevel(
            finalWarehouseId,
            item.productId,
            item.variantId || null,
            -item.quantity,
            tx
          )
        }
      }

      // Update quotation status to ACCEPTED
      await tx.quotation.update({
        where: { id: params.id },
        data: { status: 'ACCEPTED' },
      })

      return invoice
    })

    return NextResponse.json(result, { status: 201 })
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      )
    }
    console.error('Error converting quotation:', error)
    return NextResponse.json(
      { error: 'Failed to convert quotation' },
      { status: 500 }
    )
  }
}
