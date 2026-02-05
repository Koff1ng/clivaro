import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/api-middleware'
import { PERMISSIONS } from '@/lib/permissions'
import { getPrismaForRequest } from '@/lib/get-tenant-prisma'
import { z } from 'zod'
import { logActivity } from '@/lib/activity'

const createPaymentSchema = z.object({
  amount: z.number().min(0.01),
  method: z.enum(['CASH', 'CARD', 'TRANSFER']),
  reference: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
})

export async function POST(
  request: Request,
  { params }: { params: { id: string } | Promise<{ id: string }> }
) {
  const resolvedParams = await Promise.resolve(params)
  const invoiceId = resolvedParams.id

  const session = await requirePermission(request as any, PERMISSIONS.MANAGE_SALES)

  if (session instanceof NextResponse) {
    return session
  }

  // Obtener el cliente Prisma correcto (tenant o master según el usuario)
  const prisma = await getPrismaForRequest(request, session)

  try {
    const body = await request.json()
    const data = createPaymentSchema.parse(body)

    // Obtener la factura con sus pagos
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        payments: {
          select: {
            amount: true,
          },
        },
      },
    })

    if (!invoice) {
      return NextResponse.json(
        { error: 'Factura no encontrada' },
        { status: 404 }
      )
    }

    // Verificar que la factura no esté anulada
    if (invoice.status === 'ANULADA' || invoice.status === 'VOID') {
      return NextResponse.json(
        { error: 'No se puede registrar un pago en una factura anulada' },
        { status: 400 }
      )
    }

    // Calcular el total pagado actual
    const totalPaid = invoice.payments.reduce((sum, p) => sum + p.amount, 0)
    const newTotalPaid = totalPaid + data.amount

    // Verificar que no se exceda el total de la factura
    if (newTotalPaid > invoice.total) {
      return NextResponse.json(
        { error: `El pago excede el total de la factura. Total: ${invoice.total}, Pagado: ${totalPaid}, Nuevo pago: ${data.amount}` },
        { status: 400 }
      )
    }

    // 7. Payments Logic
    // Find or create Payment Method ID (if provided as string name) or use existing
    // The schema allows `methodName` for now, but we should try to link to PaymentMethod
    const methodStr = data.method
    let paymentMethodId = ''

    // Try to find by name if no ID (for now we rely on name enum in schema but database has dynamic)
    const pm = await prisma.paymentMethod.findFirst({
      where: { name: methodStr }
    })

    if (pm) {
      paymentMethodId = pm.id
    } else {
      // Create if missing (legacy safety)
      const newPm = await prisma.paymentMethod.create({
        data: {
          name: methodStr,
          type: methodStr === 'CASH' ? 'CASH' : 'ELECTRONIC'
        }
      })
      paymentMethodId = newPm.id
    }

    // Calcular el nuevo balance
    const currentBalance = invoice.balance ?? (invoice.total - totalPaid)
    const newBalance = Math.max(0, currentBalance - data.amount)

    // Check Open Shift for this user to record movement
    const openShift = await prisma.cashShift.findFirst({
      where: {
        userId: (session.user as any).id,
        status: 'OPEN',
      },
    })

    // Crear el pago y actualizar el estado de la factura en una transacción
    const result = await prisma.$transaction(async (tx) => {
      // Crear el pago
      const payment = await tx.payment.create({
        data: {
          invoiceId: invoice.id,
          amount: data.amount,
          method: data.method,
          paymentMethodId: paymentMethodId,
          reference: data.reference || null,
          notes: data.notes || null,
          createdById: (session.user as any).id,
        },
      })

      // Determinar el nuevo estado
      let newStatus: string
      if (newBalance <= 0.01) {
        newStatus = 'PAGADA'
      } else {
        newStatus = 'EN_COBRANZA'
      }

      // Actualizar el estado de la factura y balance
      await tx.invoice.update({
        where: { id: invoiceId },
        data: {
          status: newStatus,
          balance: newBalance,
          paidAt: newStatus === 'PAGADA' ? new Date() : invoice.paidAt,
          updatedById: (session.user as any).id,
        },
      })

      // Actualizar deuda del cliente
      if (invoice.customerId) {
        await tx.customer.update({
          where: { id: invoice.customerId },
          data: {
            currentBalance: { decrement: data.amount }
          }
        })
      }

      // Update Cash Shift if applicable
      if (openShift) {
        // Shift Summary
        await tx.shiftSummary.upsert({
          where: {
            shiftId_paymentMethodId: {
              shiftId: openShift.id,
              paymentMethodId: paymentMethodId
            }
          },
          update: {
            expectedAmount: { increment: data.amount }
          },
          create: {
            shiftId: openShift.id,
            paymentMethodId: paymentMethodId,
            expectedAmount: data.amount
          }
        })

        // If CASH, update cash shift total and add movement
        if (data.method === 'CASH') {
          await tx.cashShift.update({
            where: { id: openShift.id },
            data: { expectedCash: { increment: data.amount } }
          })

          await tx.cashMovement.create({
            data: {
              cashShiftId: openShift.id,
              type: 'IN',
              amount: data.amount,
              reason: `Pago de factura ${invoice.number}`,
              createdById: (session.user as any).id,
            }
          })
        }
      }

      return { payment, newStatus }
    })

    // Audit Log
    await logActivity({
      prisma,
      type: 'PAYMENT_RECEIVE',
      subject: `Pago recibido: ${invoice.number}`,
      description: `Monto: ${data.amount}. Método: ${data.method}. Factura: ${invoice.number}`,
      userId: (session.user as any).id,
      customerId: invoice.customerId,
      metadata: { invoiceId: invoice.id, paymentId: result.payment.id, amount: data.amount }
    })

    // Accounting Integration (Non-blocking)
    import('@/lib/accounting/payment-integration').then(async ({ createJournalEntryFromPayment }) => {
      try {
        await createJournalEntryFromPayment(result.payment.id, (session.user as any).tenantId, (session.user as any).id)
      } catch (error) {
        console.error('[Accounting] Failed to create journal entry from payment:', error)
        // Don't throw - payment should succeed even if accounting fails
      }
    }).catch(e => console.error('[Accounting] Import failed:', e))

    return NextResponse.json({
      payment: result.payment,
      invoiceStatus: result.newStatus,
      message: 'Pago registrado exitosamente',
    }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Error de validación', details: error.errors },
        { status: 400 }
      )
    }
    console.error('Error creating payment:', error)
    return NextResponse.json(
      { error: 'Error al registrar el pago' },
      { status: 500 }
    )
  }
}

