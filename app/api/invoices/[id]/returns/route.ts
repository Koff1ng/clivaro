import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requirePermission } from '@/lib/api-middleware'
import { PERMISSIONS } from '@/lib/permissions'
import { withTenantTx, getTenantIdFromSession } from '@/lib/tenancy'
import { logger } from '@/lib/logger'
import { logActivity } from '@/lib/activity'
import { createCreditNoteWithAccounting } from '@/lib/credit-note-service'

export const dynamic = 'force-dynamic'
import { safeErrorMessage } from '@/lib/safe-error'

const createReturnSchema = z.object({
  reason: z.string().min(3, "El motivo debe tener al menos 3 caracteres"),
  warehouseId: z.string().min(1, "El almacén de reingreso es requerido"),
  // TODO: migrar a paymentMethodId dinámico igual que POS sale
  refundMethod: z.string().optional().nullable(),
  refundPayments: z.array(z.object({
    // TODO: migrar a paymentMethodId dinámico igual que POS sale
    method: z.string().min(1, "El método es requerido"),
    amount: z.number().min(0.01, "El monto debe ser mayor a 0"),
    reference: z.string().optional().nullable(),
    notes: z.string().optional().nullable(),
  })).min(1).optional(),
  items: z.array(z.object({
    invoiceItemId: z.string().min(1, "ID de ítem requerido"),
    quantity: z.number().positive("La cantidad debe ser mayor a 0"),
  })).min(1, "Debe devolver al menos un ítem"),
}).refine(data => !!(data.refundMethod || (data.refundPayments && data.refundPayments.length > 0)), {
  message: "Debe indicar al menos un método de reembolso (refundMethod o refundPayments)",
  path: ["refundPayments"]
})

type CreateReturnInput = z.infer<typeof createReturnSchema>

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

  const tenantId = getTenantIdFromSession(session)
  const userId = (session.user as any).id as string

  try {
    const body = await request.json()
    const parseResult = createReturnSchema.safeParse(body)

    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Error de validación', details: parseResult.error.flatten() },
        { status: 400 }
      )
    }

    const data: CreateReturnInput = parseResult.data

    if (!data.refundPayments?.length && !data.refundMethod) {
      return NextResponse.json({ error: 'Debe indicar refundMethod o refundPayments' }, { status: 400 })
    }

    const result = await withTenantTx(tenantId, async (prisma) => {
      const invoice = await prisma.invoice.findUnique({
        where: { id: invoiceId },
        include: {
          items: { include: { product: { select: { name: true } } } },
          customer: true
        },
      })

      if (!invoice) throw new Error('Factura no encontrada')
      if (['ANULADA', 'VOID'].includes(invoice.status)) throw new Error('No se puede devolver una factura anulada')

      if (['SENT', 'ACCEPTED'].includes(invoice.electronicStatus || '')) {
        throw new Error('Factura enviada/aceptada por DIAN. Para devoluciones debes emitir Nota Crédito.')
      }

      // Validar turno para reembolso en efectivo
      const cashRefund = data.refundPayments?.reduce((sum, p) => sum + (p.method === 'CASH' ? p.amount : 0), 0)
        ?? (data.refundMethod === 'CASH' ? 1 : 0)

      let openShift: any = null
      if (cashRefund > 0) {
        openShift = await prisma.cashShift.findFirst({
          where: { userId, status: 'OPEN' },
        })
        if (!openShift) throw new Error('Debes tener un turno de caja abierto para registrar devolución en efectivo.')
      }

      // Calcular cuánto ya se devolvió
      const alreadyReturnedByItem = new Map<string, number>()
      const existingReturns = await prisma.return.findMany({
        where: { invoiceId: invoice.id },
        include: { items: true },
      })
      for (const r of existingReturns) {
        for (const it of r.items) {
          alreadyReturnedByItem.set(it.invoiceItemId, (alreadyReturnedByItem.get(it.invoiceItemId) || 0) + it.quantity)
        }
      }

      const invoiceItemsById = new Map(invoice.items.map((it: any) => [it.id, it]))
      let returnTotal = 0
      const returnItemsToCreate: any[] = []

      for (const reqItem of data.items) {
        const invItem = invoiceItemsById.get(reqItem.invoiceItemId)
        if (!invItem) throw new Error('Item de factura inválido')

        const already = alreadyReturnedByItem.get(invItem.id) || 0
        const available = invItem.quantity - already
        if (reqItem.quantity > available + 0.0001) throw new Error(`Cantidad a devolver excede lo disponible. Disponible: ${available}`)

        const unitNet = invItem.unitPrice * (1 - (invItem.discount || 0) / 100)
        const lineTotal = (unitNet * (1 + (invItem.taxRate || 0) / 100)) * reqItem.quantity

        returnTotal += lineTotal
        returnItemsToCreate.push({
          invoiceItemId: invItem.id,
          quantity: reqItem.quantity,
          total: lineTotal,
          productId: invItem.productId,
          variantId: invItem.variantId || null,
        })
      }

      const refundLines = data.refundPayments?.map((p) => ({
        method: p.method,
        amount: p.amount,
        reference: p.reference || null,
        notes: p.notes || null,
      }))

      if (refundLines?.length) {
        const paid = refundLines.reduce((sum, p) => sum + p.amount, 0)
        if (Math.abs(paid - returnTotal) > 0.01) throw new Error(`El reembolso debe ser exactamente igual al total.`)
      }

      const createdReturn = await prisma.return.create({
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

      // Stock and Cash updates
      for (const it of returnItemsToCreate) {
        await prisma.stockMovement.create({
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

        const existingStock = await prisma.stockLevel.findFirst({
          where: { warehouseId: data.warehouseId, productId: it.productId, variantId: it.variantId },
        })

        if (existingStock) {
          await prisma.stockLevel.update({
            where: { id: existingStock.id },
            data: { quantity: existingStock.quantity + it.quantity },
          })
        } else {
          await prisma.stockLevel.create({
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

      const cashOut = refundLines?.length
        ? refundLines.filter(p => p.method === 'CASH').reduce((sum, p) => sum + p.amount, 0)
        : (data.refundMethod === 'CASH' ? returnTotal : 0)

      if (cashOut > 0 && openShift) {
        await prisma.cashMovement.create({
          data: {
            cashShiftId: openShift.id,
            type: 'OUT',
            amount: cashOut,
            reason: `Devolución - ${invoice.number}: ${data.reason}`,
            createdById: userId,
          },
        })
        await prisma.cashShift.update({
          where: { id: openShift.id },
          data: { expectedCash: openShift.expectedCash - cashOut },
        })
      }

      let creditNote: any = null
      if (['SENT', 'ACCEPTED'].includes(invoice.electronicStatus || '')) {
        const isTotal = returnItemsToCreate.length === invoice.items.length
        const type = isTotal ? 'TOTAL' : 'PARTIAL'
        const referenceCode = isTotal ? '20' : '22'
        const affectedPeriod = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`

        creditNote = await createCreditNoteWithAccounting(
          prisma,
          tenantId,
          userId,
          {
            invoiceId: invoice.id,
            returnId: createdReturn.id,
            type,
            referenceCode,
            reason: data.reason,
            affectedPeriod: referenceCode === '22' ? affectedPeriod : undefined,
            items: returnItemsToCreate.map(ri => {
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
          },
          { reverseInventory: true, warehouseId: data.warehouseId }
        )
      }

      const nextNotes = [
        invoice.notes || null,
        `DEVOLUCIÓN (${new Date().toISOString()}) ${returnTotal}`,
        `Motivo: ${data.reason}`
      ].filter(Boolean).join('\n')

      await prisma.invoice.update({
        where: { id: invoice.id },
        data: { notes: nextNotes, updatedById: userId },
      })

      await logActivity({
        prisma,
        type: 'INVOICE_RETURN',
        subject: `Devolución de factura: ${invoice.number}`,
        description: `Motivo: ${data.reason}. Total devuelto: ${returnTotal}.`,
        userId,
        customerId: invoice.customerId,
        metadata: { invoiceId: invoice.id, returnId: createdReturn.id, total: returnTotal }
      })

      return { return: createdReturn, returnTotal, creditNote }
    })

    return NextResponse.json(result, { status: 201 })
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Error de validación', details: error.errors }, { status: 400 })
    }
    logger.error('Error creating return', error)
    return NextResponse.json({ error: safeErrorMessage(error, 'Error al crear devolución') }, { status: 500 })
  }
}


