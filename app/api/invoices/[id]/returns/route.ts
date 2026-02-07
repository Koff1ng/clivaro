import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requirePermission } from '@/lib/api-middleware'
import { PERMISSIONS } from '@/lib/permissions'
import { getPrismaForRequest } from '@/lib/get-tenant-prisma'
import { logger } from '@/lib/logger'
import { logActivity } from '@/lib/activity'
import { createCreditNoteWithAccounting } from '@/lib/credit-note-service'

const createReturnSchema = z.object({
  reason: z.string().min(3),
  warehouseId: z.string().min(1),
  // Compat (modo simple)
  refundMethod: z.enum(['CASH', 'CARD', 'TRANSFER']).optional(),
  // Nuevo: reembolso mixto
  refundPayments: z.array(z.object({
    method: z.enum(['CASH', 'CARD', 'TRANSFER']),
    amount: z.number().min(0.01),
    reference: z.string().optional().nullable(),
    notes: z.string().optional().nullable(),
  })).min(1).optional(),
  items: z.array(z.object({
    invoiceItemId: z.string().min(1),
    quantity: z.number().positive(),
  })).min(1),
})

export async function POST(
  request: Request,
  { params }: { params: { id: string } | Promise<{ id: string }> }
) {
  const resolvedParams = await Promise.resolve(params)
  const invoiceId = resolvedParams.id

  const session = await requirePermission(request as any, [
    PERMISSIONS.MANAGE_RETURNS,
    PERMISSIONS.VOID_INVOICES,
  ])
  if (session instanceof NextResponse) return session

  const prisma = await getPrismaForRequest(request, session)

  try {
    const body = await request.json()
    const data = createReturnSchema.parse(body)

    if (!data.refundPayments?.length && !data.refundMethod) {
      return NextResponse.json({ error: 'Debe indicar refundMethod o refundPayments' }, { status: 400 })
    }

    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        items: {
          include: {
            product: { select: { name: true } }
          }
        },
        customer: true
      },
    })

    if (!invoice) return NextResponse.json({ error: 'Factura no encontrada' }, { status: 404 })

    if (invoice.status === 'ANULADA' || invoice.status === 'VOID') {
      return NextResponse.json({ error: 'No se puede devolver una factura anulada' }, { status: 400 })
    }

    if (invoice.electronicStatus === 'SENT' || invoice.electronicStatus === 'ACCEPTED') {
      return NextResponse.json(
        { error: 'Factura enviada/aceptada por DIAN. Para devoluciones debes emitir Nota Crédito.' },
        { status: 400 }
      )
    }

    const userId = (session.user as any).id as string

    const result = await prisma.$transaction(async (tx) => {
      // Validar turno para reembolso en efectivo
      let openShift: any = null
      const cashRefund = data.refundPayments?.reduce((sum, p) => sum + (p.method === 'CASH' ? p.amount : 0), 0)
        ?? (data.refundMethod === 'CASH' ? 1 : 0)

      if (cashRefund) {
        openShift = await tx.cashShift.findFirst({
          where: { userId, status: 'OPEN' },
        })
        if (!openShift) {
          throw new Error('Debes tener un turno de caja abierto para registrar devolución en efectivo.')
        }
      }

      // Calcular cuánto ya se devolvió por invoiceItem
      const alreadyReturnedByItem = new Map<string, number>()
      const existingReturns = await tx.return.findMany({
        where: { invoiceId: invoice.id },
        include: { items: true },
      })
      for (const r of existingReturns) {
        for (const it of r.items) {
          alreadyReturnedByItem.set(it.invoiceItemId, (alreadyReturnedByItem.get(it.invoiceItemId) || 0) + it.quantity)
        }
      }

      const invoiceItemsById = new Map(invoice.items.map((it: any) => [it.id, it]))

      // Validar cantidades y calcular totales
      let returnTotal = 0
      const returnItemsToCreate: Array<{ invoiceItemId: string; quantity: number; total: number; productId: string; variantId: string | null }> = []

      for (const reqItem of data.items) {
        const invItem = invoiceItemsById.get(reqItem.invoiceItemId)
        if (!invItem) {
          throw new Error('Item de factura inválido')
        }
        const already = alreadyReturnedByItem.get(invItem.id) || 0
        const available = invItem.quantity - already
        if (reqItem.quantity > available + 0.0001) {
          throw new Error(`Cantidad a devolver excede lo disponible. Disponible: ${available}`)
        }

        const unitNet = invItem.unitPrice * (1 - (invItem.discount || 0) / 100)
        const lineSubtotal = unitNet * reqItem.quantity
        const lineTax = lineSubtotal * ((invItem.taxRate || 0) / 100)
        const lineTotal = lineSubtotal + lineTax

        returnTotal += lineTotal
        returnItemsToCreate.push({
          invoiceItemId: invItem.id,
          quantity: reqItem.quantity,
          total: lineTotal,
          productId: invItem.productId,
          variantId: invItem.variantId || null,
        })
      }

      // Validar reembolso mixto (si aplica)
      const refundLines = data.refundPayments?.map((p) => ({
        method: p.method,
        amount: p.amount,
        reference: p.reference || null,
        notes: p.notes || null,
      }))

      if (refundLines?.length) {
        const paid = refundLines.reduce((sum, p) => sum + p.amount, 0)
        if (Math.abs(paid - returnTotal) > 0.01) {
          throw new Error(`El reembolso debe ser exactamente igual al total. Total: ${returnTotal}, Reembolso: ${paid}`)
        }
      }

      // Crear Return + items + payment(s)
      const createdReturn = await tx.return.create({
        data: {
          invoiceId: invoice.id,
          status: 'COMPLETED',
          reason: data.reason,
          total: returnTotal,
          createdById: userId,
          items: {
            create: returnItemsToCreate.map((it) => ({
              invoiceItemId: it.invoiceItemId,
              quantity: it.quantity,
              total: it.total,
            })),
          },
          payments: refundLines?.length
            ? {
              create: refundLines.map((p) => ({
                amount: p.amount,
                method: p.method,
                reference: p.reference,
                notes: p.notes || `Devolución parcial - ${invoice.number}`,
                createdById: userId,
              })),
            }
            : {
              create: {
                amount: returnTotal,
                method: data.refundMethod!,
                notes: `Devolución parcial - ${invoice.number}`,
                createdById: userId,
              },
            },
        },
        include: { items: true, payments: true },
      })

      // Stock IN por cada item devuelto
      for (const it of returnItemsToCreate) {
        await tx.stockMovement.create({
          data: {
            warehouseId: data.warehouseId,
            productId: it.productId,
            variantId: it.variantId,
            type: 'IN',
            quantity: it.quantity,
            reason: `Return - ${data.reason}`,
            createdById: userId,
            reference: invoice.number,
          },
        })

        const existingStock = await tx.stockLevel.findFirst({
          where: {
            warehouseId: data.warehouseId,
            productId: it.productId,
            variantId: it.variantId,
          },
        })

        if (existingStock) {
          await tx.stockLevel.update({
            where: { id: existingStock.id },
            data: { quantity: existingStock.quantity + it.quantity },
          })
        } else {
          await tx.stockLevel.create({
            data: {
              warehouseId: data.warehouseId,
              productId: it.productId,
              variantId: it.variantId,
              quantity: it.quantity,
              minStock: 0,
            },
          })
        }
      }

      // Si es reembolso en efectivo, registrar salida de caja y disminuir expectedCash
      const cashOut = refundLines?.length
        ? refundLines.filter(p => p.method === 'CASH').reduce((sum, p) => sum + p.amount, 0)
        : (data.refundMethod === 'CASH' ? returnTotal : 0)

      if (cashOut > 0 && openShift) {
        await tx.cashMovement.create({
          data: {
            cashShiftId: openShift.id,
            type: 'OUT',
            amount: cashOut,
            reason: `Devolución - ${invoice.number}: ${data.reason}`,
            createdById: userId,
          },
        })
        await tx.cashShift.update({
          where: { id: openShift.id },
          data: { expectedCash: openShift.expectedCash - cashOut },
        })
      }

      // Generate Credit Note for electronic invoices
      let creditNote: any = null
      if (invoice.electronicStatus === 'SENT' || invoice.electronicStatus === 'ACCEPTED') {
        try {
          // Determine if it's total or partial return
          const isTotal = returnItemsToCreate.length === invoice.items.length &&
            returnItemsToCreate.every(ri => {
              const invItem = invoice.items.find((ii: any) => ii.id === ri.invoiceItemId)
              return invItem && Math.abs(ri.quantity - invItem.quantity) < 0.0001
            })

          const type = isTotal ? 'TOTAL' : 'PARTIAL'
          const referenceCode = isTotal ? '20' : '22'

          // Get current period for code 22
          const now = new Date()
          const affectedPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

          // Map return items to credit note items
          const creditNoteItems = returnItemsToCreate.map(ri => {
            const invItem = invoice.items.find((ii: any) => ii.id === ri.invoiceItemId)
            return {
              invoiceItemId: ri.invoiceItemId,
              productId: ri.productId,
              variantId: ri.variantId,
              description: invItem?.preparationNotes || `${invItem?.product?.name || 'Producto'}`,
              quantity: ri.quantity,
              unitPrice: invItem?.unitPrice || 0,
              discount: invItem?.discount || 0,
              taxRate: invItem?.taxRate || 0
            }
          })

          // Get tenantId from session since invoice doesn't have it directly
          const tenantId = (session.user as any).tenantId || ''

          creditNote = await createCreditNoteWithAccounting(
            tx,
            tenantId,
            userId,
            {
              invoiceId: invoice.id,
              returnId: createdReturn.id,
              type,
              referenceCode,
              reason: data.reason,
              affectedPeriod: referenceCode === '22' ? affectedPeriod : undefined,
              items: creditNoteItems
            },
            {
              reverseInventory: true,
              warehouseId: data.warehouseId
            }
          )

          // Note: creditNote relation will be automatically set via returnId in CreditNote
        } catch (err: any) {
          logger.error('Failed to create credit note for return', err, { invoiceId: invoice.id })
          // Don't fail the whole return if credit note fails
        }
      }

      // Anotar en la factura (sin tocar totales por ahora)
      const stamp = new Date().toISOString()
      const refundLabel = refundLines?.length
        ? `mixto (${refundLines.map(p => `${p.method}:${p.amount}`).join(', ')})`
        : String(data.refundMethod)
      const notes = [invoice.notes || null, `DEVOLUCIÓN (${stamp}) ${returnTotal} via ${refundLabel}`, `Motivo: ${data.reason}`]
        .filter(Boolean)
        .join('\n')
      await tx.invoice.update({
        where: { id: invoice.id },
        data: { notes, updatedById: userId },
      })

      return { return: createdReturn, returnTotal, creditNote }
    })

    // Audit Log
    await logActivity({
      prisma,
      type: 'INVOICE_RETURN',
      subject: `Devolución de factura: ${invoice.number}`,
      description: `Motivo: ${data.reason}. Total devuelto: ${result.returnTotal}. Items: ${data.items.length}.`,
      userId: (session.user as any).id,
      customerId: invoice.customerId,
      metadata: { invoiceId: invoice.id, returnId: result.return.id, total: result.returnTotal }
    })

    return NextResponse.json(result, { status: 201 })
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Error de validación', details: error.errors }, { status: 400 })
    }
    logger.error('Error creating return', error, { invoiceId, endpoint: '/api/invoices/[id]/returns' })
    return NextResponse.json({ error: error.message || 'Error al crear devolución' }, { status: 500 })
  }
}


