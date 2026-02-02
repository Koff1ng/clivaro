import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/api-middleware'
import { PERMISSIONS } from '@/lib/permissions'
import { withTenantTx, getTenantIdFromSession } from '@/lib/tenancy'
import { updateStockLevel } from '@/lib/inventory'
import { calculateGranularTaxes } from '@/lib/taxes'
import { z } from 'zod'
import { Prisma } from '@prisma/client'

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

  try {
    const tenantId = getTenantIdFromSession(session)
    const body = await request.json().catch(() => ({}))
    const { paymentMethod = 'CASH', warehouseId } = convertQuotationSchema.parse(body)

    const result = await withTenantTx(tenantId, async (tx: Prisma.TransactionClient) => {
      const quotation = await tx.quotation.findUnique({
        where: { id: params.id },
        include: {
          items: {
            include: {
              product: {
                include: {
                  taxes: true
                }
              },
            },
          },
          customer: true,
        },
      })

      if (!quotation) {
        throw new Error('Cotización no encontrada')
      }

      if (quotation.status === 'ACCEPTED') {
        throw new Error('La cotización ya fue aceptada')
      }

      // Get default warehouse if not provided
      let finalWarehouseId = warehouseId
      if (!finalWarehouseId) {
        const warehouse = await tx.warehouse.findFirst({
          where: { active: true },
        })
        if (!warehouse) {
          throw new Error('No hay almacén disponible')
        }
        finalWarehouseId = warehouse.id
      }

      // Process items and taxes
      const processedItems = quotation.items.map((item: any) => {
        const productTaxes = item.product.taxes.length > 0
          ? item.product.taxes.map((t: any) => ({
            id: t.id,
            name: t.name,
            rate: t.rate,
            type: t.type
          }))
          : item.taxRate > 0
            ? [{ id: 'legacy', name: 'IVA (Legacy)', rate: item.taxRate, type: 'IVA' }]
            : []

        const taxResult = calculateGranularTaxes(item.subtotal, productTaxes)

        return {
          ...item,
          taxes: taxResult.taxes,
          calculatedTax: taxResult.totalTax
        }
      })

      // Group totals for tax summary
      const taxSummariesByRate = new Map<string, { taxRateId: string; name: string; rate: number; base: number; amount: number }>()
      processedItems.forEach((pi: any) => {
        pi.taxes.forEach((t: any) => {
          const key = t.taxRateId
          const existing = taxSummariesByRate.get(key)
          if (existing) {
            existing.base += pi.subtotal
            existing.amount += t.amount
          } else {
            taxSummariesByRate.set(key, {
              taxRateId: t.taxRateId,
              name: t.name,
              rate: t.rate,
              base: pi.subtotal,
              amount: t.amount
            })
          }
        })
      })

      const invoiceCount = await tx.invoice.count()
      const prefix = process.env.BILLING_RESOLUTION_PREFIX || 'FV'
      const consecutive = String(invoiceCount + 1).padStart(6, '0')
      const invoiceNumber = `${prefix}-${consecutive}`

      const totalCalculatedTax = processedItems.reduce((sum: number, item: any) => sum + item.calculatedTax, 0)

      const invoice = await tx.invoice.create({
        data: {
          number: invoiceNumber,
          prefix: prefix,
          consecutive: consecutive,
          customerId: quotation.customerId,
          status: 'PAGADA',
          subtotal: quotation.subtotal,
          discount: quotation.discount,
          tax: totalCalculatedTax,
          total: quotation.subtotal - quotation.discount + totalCalculatedTax,
          notes: quotation.notes,
          issuedAt: new Date(),
          paidAt: new Date(),
          electronicStatus: 'PENDING',
          createdById: (session.user as any).id,
          items: {
            create: processedItems.map((pi: any) => ({
              product: { connect: { id: pi.productId } },
              ...(pi.variantId ? { variant: { connect: { id: pi.variantId } } } : {}),
              quantity: pi.quantity,
              unitPrice: pi.unitPrice,
              discount: pi.discount,
              taxRate: pi.taxRate,
              subtotal: pi.subtotal,
              lineTaxes: {
                create: pi.taxes.map((t: any) => ({
                  ...(t.taxRateId !== 'legacy' ? { taxRate: { connect: { id: t.taxRateId } } } : {}),
                  name: t.name,
                  rate: t.rate,
                  taxAmount: t.amount,
                  baseAmount: pi.subtotal
                })) as any
              }
            })) as any
          },
          taxSummary: {
            create: Array.from(taxSummariesByRate.values()).map((ts: any) => ({
              ...(ts.taxRateId !== 'legacy' ? { taxRate: { connect: { id: ts.taxRateId } } } : {}),
              name: ts.name,
              rate: ts.rate,
              baseAmount: ts.base,
              taxAmount: ts.amount
            })) as any
          }
        }
      })

      // Create payment
      await tx.payment.create({
        data: {
          invoiceId: invoice.id,
          amount: invoice.total,
          method: paymentMethod,
          createdById: (session.user as any).id,
        },
      })

      // Update Stock Levels and Movements
      for (const pi of processedItems) {
        if (pi.product.trackStock) {
          await updateStockLevel(finalWarehouseId, pi.productId, pi.variantId || null, -pi.quantity, tx, {
            type: 'OUT',
            reason: 'Invoice from Quotation',
            reasonCode: 'SALE',
            reference: invoiceNumber,
            createdById: (session.user as any).id
          })
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
        { error: 'Error de validación', details: error.errors },
        { status: 400 }
      )
    }
    console.error('Error al convertir cotización:', error)
    return NextResponse.json(
      { error: error.message || 'Error al convertir cotización' },
      { status: 500 }
    )
  }
}
