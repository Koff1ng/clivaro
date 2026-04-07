import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requirePermission } from '@/lib/api-middleware'
import { PERMISSIONS } from '@/lib/permissions'
import { withTenantTx, getTenantIdFromSession } from '@/lib/tenancy'
import { logger } from '@/lib/logger'
import { logActivity } from '@/lib/activity'

export const dynamic = 'force-dynamic'

const voidInvoiceSchema = z.object({
  reason: z.string().min(3),
})

export async function POST(
  request: Request,
  { params }: { params: { id: string } | Promise<{ id: string }> }
) {
  const resolvedParams = await Promise.resolve(params)
  const invoiceId = resolvedParams.id

  const session = await requirePermission(request as any, [
    PERMISSIONS.VOID_INVOICES,
    PERMISSIONS.MANAGE_RETURNS,
  ])
  if (session instanceof NextResponse) return session

  const tenantId = getTenantIdFromSession(session)
  const userId = (session.user as any).id as string

  try {
    const body = await request.json()
    const { reason } = voidInvoiceSchema.parse(body)

    const result = await withTenantTx(tenantId, async (prisma) => {
      const invoice = await prisma.invoice.findUnique({
        where: { id: invoiceId },
        include: { items: true, payments: { include: { paymentMethod: true } } },
      })

      if (!invoice) throw new Error('Factura no encontrada')
      if (['ANULADA', 'VOID'].includes(invoice.status)) throw new Error('La factura ya está anulada')

      if (['ACCEPTED', 'SENT'].includes(invoice.electronicStatus || '')) {
        throw new Error('Esta factura ya fue enviada/aceptada por DIAN. Debes generar una Nota Crédito.')
      }

      // Group payments
      const sums = invoice.payments.reduce(
        (acc, p) => {
          const method = (p.method || '').toUpperCase()
          if (method === 'CASH') acc.cash += p.amount
          else if (method === 'CARD') acc.card += p.amount
          else if (method === 'TRANSFER') acc.transfer += p.amount
          else acc.other += p.amount
          acc.total += p.amount
          return acc
        },
        { cash: 0, card: 0, transfer: 0, other: 0, total: 0 }
      )

      // Find stock movements
      const outMovements = await prisma.stockMovement.findMany({
        where: { reference: invoice.number, type: 'OUT' },
      })

      // Nested logic for Cash Shift
      if (sums.cash > 0) {
        const openShift = await prisma.cashShift.findFirst({
          where: { userId, status: 'OPEN' },
        })

        if (!openShift) throw new Error('Debes tener un turno de caja abierto para registrar devolución en efectivo.')

        await prisma.cashMovement.create({
          data: {
            cashShiftId: openShift.id,
            type: 'OUT',
            amount: sums.cash,
            reason: `Anulación/Devolución - ${invoice.number}: ${reason}`,
            createdById: userId,
          },
        })

        await prisma.cashShift.update({
          where: { id: openShift.id },
          data: { expectedCash: openShift.expectedCash - sums.cash },
        })
      }

      // L4 FIX: Revert ShiftSummary for each payment method
      for (const payment of invoice.payments) {
        const pmId = (payment as any).paymentMethodId
        if (!pmId) continue
        try {
          const openShiftForSummary = await prisma.cashShift.findFirst({
            where: { userId, status: 'OPEN' },
          })
          if (openShiftForSummary) {
            await prisma.shiftSummary.updateMany({
              where: { shiftId: openShiftForSummary.id, paymentMethodId: pmId },
              data: { expectedAmount: { decrement: payment.amount } },
            })
          }
        } catch { /* ShiftSummary may not exist */ }
      }

      // H5 FIX: Reverse customer balance for credit sales
      if (['EN_COBRANZA'].includes(invoice.status) && invoice.balance > 0 && invoice.customerId) {
        await prisma.customer.update({
          where: { id: invoice.customerId },
          data: { currentBalance: { decrement: invoice.balance } },
        })
      }

      // Restock
      for (const m of outMovements) {
        await prisma.stockMovement.create({
          data: {
            warehouseId: m.warehouseId,
            productId: m.productId,
            variantId: m.variantId,
            type: 'IN',
            quantity: m.quantity,
            reason: `Void/Return - ${reason}`,
            createdById: userId,
            reference: invoice.number,
          },
        })

        const existing = await prisma.stockLevel.findFirst({
          where: {
            warehouseId: m.warehouseId,
            productId: m.productId,
            variantId: m.variantId,
            zoneId: m.zoneId ?? null, // M5 FIX: include zoneId
          },
        })

        if (existing) {
          await prisma.stockLevel.update({
            where: { id: existing.id },
            data: { quantity: existing.quantity + m.quantity },
          })
        } else {
          await prisma.stockLevel.create({
            data: {
              warehouseId: m.warehouseId,
              productId: m.productId,
              variantId: m.variantId,
              quantity: m.quantity,
              minStock: 0,
            },
          })
        }
      }

      const stamp = new Date().toISOString()
      const nextNotes = [
        invoice.notes || null,
        `ANULADA (${stamp})`,
        `Motivo: ${reason}`,
        `Pagos (ref): efectivo=${sums.cash}, tarjeta=${sums.card}, transferencia=${sums.transfer}`,
      ].filter(Boolean).join('\n')

      const updated = await prisma.invoice.update({
        where: { id: invoiceId },
        data: {
          status: 'ANULADA',
          paidAt: null,
          notes: nextNotes,
          updatedById: userId,
        },
      })

      await logActivity({
        prisma,
        type: 'INVOICE_VOID',
        subject: `Factura Anulada: ${invoice.number}`,
        description: `Motivo: ${reason}. Total reintegrado: ${sums.total}.`,
        userId,
        customerId: invoice.customerId,
        metadata: { invoiceId: invoice.id, invoiceNumber: invoice.number, reason, refund: sums.total }
      })

      return {
        invoice: updated,
        restockedMovements: outMovements.length,
        refund: { cash: sums.cash, card: sums.card, transfer: sums.transfer, other: sums.other },
      }
    })

    return NextResponse.json(result)
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Error de validación', details: error.errors }, { status: 400 })
    }
    logger.error('Error voiding invoice', error)
    return NextResponse.json({ error: error.message || 'Error al anular la factura' }, { status: 500 })
  }
}


