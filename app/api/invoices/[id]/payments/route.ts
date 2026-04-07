import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/api-middleware'
import { PERMISSIONS } from '@/lib/permissions'
import { withTenantTx, getTenantIdFromSession } from '@/lib/tenancy'
import { z } from 'zod'
import { logActivity } from '@/lib/activity'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

const createPaymentSchema = z.object({
  amount: z.number().min(0.01, "El monto debe ser mayor a 0"),
  // TODO: migrar a paymentMethodId dinámico igual que POS sale
  // cuando se unifique el flujo de pagos de facturas
  method: z.string().min(1, "El método es requerido"),
  reference: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
})

type CreatePaymentInput = z.infer<typeof createPaymentSchema>

export async function POST(
  request: Request,
  { params }: { params: { id: string } | Promise<{ id: string }> }
) {
  const resolvedParams = await Promise.resolve(params)
  const invoiceId = resolvedParams.id

  const session = await requirePermission(request as any, PERMISSIONS.MANAGE_SALES)
  if (session instanceof NextResponse) return session

  const tenantId = getTenantIdFromSession(session)
  const userId = (session.user as any).id

  try {
    const body = await request.json()
    const parseResult = createPaymentSchema.safeParse(body)

    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Error de validación', details: parseResult.error.flatten() },
        { status: 400 }
      )
    }

    const data: CreatePaymentInput = parseResult.data

    const result = await withTenantTx(tenantId, async (prisma) => {
      const invoice = await prisma.invoice.findUnique({
        where: { id: invoiceId },
        include: { payments: { select: { amount: true } } },
      })

      if (!invoice) throw new Error('Factura no encontrada')
      if (['ANULADA', 'VOID'].includes(invoice.status)) throw new Error('No se puede registrar un pago en una factura anulada')

      const totalPaid = invoice.payments.reduce((sum, p) => sum + p.amount, 0)
      const newTotalPaid = Math.round((totalPaid + data.amount) * 100) / 100
      if (newTotalPaid > invoice.total + 0.01) throw new Error(`El pago excede el total de la factura. Total: ${invoice.total}, Ya pagado: ${totalPaid}, Nuevo pago: ${data.amount}`)

      const methodStr = data.method
      let pm = await prisma.paymentMethod.findFirst({ where: { name: methodStr } })
      if (!pm) {
        pm = await prisma.paymentMethod.create({
          data: { name: methodStr, type: methodStr === 'CASH' ? 'CASH' : 'ELECTRONIC' }
        })
      }
      const paymentMethodId = pm.id

      // Always derive balance from total - totalPaid (not from stored balance which can drift)
      const newBalance = Math.round(Math.max(0, invoice.total - newTotalPaid) * 100) / 100

      const openShift = await prisma.cashShift.findFirst({ where: { userId, status: 'OPEN' } })

      const payment = await prisma.payment.create({
        data: {
          invoiceId: invoice.id,
          amount: data.amount,
          method: data.method,
          paymentMethodId,
          reference: data.reference || null,
          notes: data.notes || null,
          createdById: userId,
        },
      })

      const newStatus = newBalance <= 0.01 ? 'PAGADA' : 'EN_COBRANZA'

      await prisma.invoice.update({
        where: { id: invoiceId },
        data: {
          status: newStatus,
          balance: newBalance,
          paidAt: newStatus === 'PAGADA' ? new Date() : invoice.paidAt,
          updatedById: userId,
        },
      })

      if (invoice.customerId) {
        await prisma.customer.update({
          where: { id: invoice.customerId },
          data: { currentBalance: { decrement: data.amount } }
        })
      }

      if (openShift) {
        await prisma.shiftSummary.upsert({
          where: { shiftId_paymentMethodId: { shiftId: openShift.id, paymentMethodId } },
          update: { expectedAmount: { increment: data.amount } },
          create: { shiftId: openShift.id, paymentMethodId, expectedAmount: data.amount }
        })

        if (data.method === 'CASH') {
          await prisma.cashShift.update({
            where: { id: openShift.id },
            data: { expectedCash: { increment: data.amount } }
          })
          await prisma.cashMovement.create({
            data: {
              cashShiftId: openShift.id,
              type: 'IN',
              amount: data.amount,
              reason: `Pago de factura ${invoice.number}`,
              createdById: userId,
            }
          })
        }
      }

      await logActivity({
        prisma,
        type: 'PAYMENT_RECEIVE',
        subject: `Pago recibido: ${invoice.number}`,
        description: `Monto: ${data.amount}. Método: ${data.method}.`,
        userId,
        customerId: invoice.customerId,
        metadata: { invoiceId: invoice.id, paymentId: payment.id, amount: data.amount }
      })

      return { payment, newStatus }
    })

    // Background accounting integration
    import('@/lib/accounting/payment-integration').then(async ({ createJournalEntryFromPayment }) => {
      try {
        await createJournalEntryFromPayment(result.payment.id, tenantId, userId)
      } catch (err) {
        logger.error('[Accounting] Failed entry creation', err)
      }
    }).catch(e => logger.error('[Accounting] Import failed', e))

    return NextResponse.json({
      payment: result.payment,
      invoiceStatus: result.newStatus,
      message: 'Pago registrado exitosamente',
    }, { status: 201 })
  } catch (error: any) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: 'Error de validación', details: error.errors }, { status: 400 })
    logger.error('Error creating payment', error)
    return NextResponse.json({ error: error.message || 'Error al registrar el pago' }, { status: 500 })
  }
}

