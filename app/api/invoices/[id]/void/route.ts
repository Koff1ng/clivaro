import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requirePermission } from '@/lib/api-middleware'
import { PERMISSIONS } from '@/lib/permissions'
import { getPrismaForRequest } from '@/lib/get-tenant-prisma'
import { logger } from '@/lib/logger'

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

  const prisma = await getPrismaForRequest(request, session)

  try {
    const body = await request.json()
    const { reason } = voidInvoiceSchema.parse(body)

    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        items: true,
        payments: true,
      },
    })

    if (!invoice) {
      return NextResponse.json({ error: 'Factura no encontrada' }, { status: 404 })
    }

    if (invoice.status === 'ANULADA' || invoice.status === 'VOID') {
      return NextResponse.json({ error: 'La factura ya está anulada' }, { status: 400 })
    }

    if (invoice.electronicStatus === 'ACCEPTED' || invoice.electronicStatus === 'SENT') {
      return NextResponse.json(
        { error: 'Esta factura ya fue enviada/aceptada por DIAN. Debes generar una Nota Crédito (no anulación directa).' },
        { status: 400 }
      )
    }

    // Agrupar pagos por método (para devolución/refund)
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

    // Encontrar movimientos de stock de la venta (POS) por referencia = invoice.number
    const outMovements = await prisma.stockMovement.findMany({
      where: {
        reference: invoice.number,
        type: 'OUT',
      },
    })

    const userId = (session.user as any).id as string

    const result = await prisma.$transaction(async (tx) => {
      // Si hay efectivo a devolver, debe existir turno abierto del usuario actual
      if (sums.cash > 0) {
        const openShift = await tx.cashShift.findFirst({
          where: {
            userId,
            status: 'OPEN',
          },
        })

        if (!openShift) {
          throw new Error('Debes tener un turno de caja abierto para registrar devolución en efectivo.')
        }

        await tx.cashMovement.create({
          data: {
            cashShiftId: openShift.id,
            type: 'OUT',
            amount: sums.cash,
            reason: `Anulación/Devolución - ${invoice.number}: ${reason}`,
            createdById: userId,
          },
        })

        await tx.cashShift.update({
          where: { id: openShift.id },
          data: {
            expectedCash: openShift.expectedCash - sums.cash,
          },
        })
      }

      // Reintegrar stock basado en movimientos OUT previos (si existieron)
      for (const m of outMovements) {
        await tx.stockMovement.create({
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

        // Actualizar stock level
        const existing = await tx.stockLevel.findFirst({
          where: {
            warehouseId: m.warehouseId,
            productId: m.productId,
            variantId: m.variantId,
          },
        })

        if (existing) {
          await tx.stockLevel.update({
            where: { id: existing.id },
            data: { quantity: existing.quantity + m.quantity },
          })
        } else {
          await tx.stockLevel.create({
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
      ]
        .filter(Boolean)
        .join('\n')

      const updated = await tx.invoice.update({
        where: { id: invoiceId },
        data: {
          status: 'ANULADA',
          paidAt: null,
          notes: nextNotes,
          updatedById: userId,
        },
      })

      return {
        invoice: updated,
        restockedMovements: outMovements.length,
        refund: { cash: sums.cash, card: sums.card, transfer: sums.transfer, other: sums.other },
      }
    })

    return NextResponse.json(result, { status: 200 })
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Error de validación', details: error.errors }, { status: 400 })
    }
    logger.error('Error voiding invoice', error, { invoiceId, endpoint: '/api/invoices/[id]/void' })
    return NextResponse.json(
      { error: error.message || 'Error al anular la factura' },
      { status: 500 }
    )
  }
}


