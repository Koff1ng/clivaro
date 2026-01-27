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

    // Crear el pago y actualizar el estado de la factura en una transacción
    const result = await prisma.$transaction(async (tx) => {
      // Crear el pago
      const payment = await tx.payment.create({
        data: {
          invoiceId: invoice.id,
          amount: data.amount,
          method: data.method,
          reference: data.reference || null,
          notes: data.notes || null,
          createdById: (session.user as any).id,
        },
      })

      // Determinar el nuevo estado basándose en el total pagado
      let newStatus: string
      if (newTotalPaid >= invoice.total) {
        newStatus = 'PAGADA'
      } else if (newTotalPaid > 0) {
        newStatus = 'EN_COBRANZA'
      } else {
        newStatus = 'EMITIDA'
      }

      // Actualizar el estado de la factura
      await tx.invoice.update({
        where: { id: invoiceId },
        data: {
          status: newStatus,
          paidAt: newTotalPaid >= invoice.total ? new Date() : invoice.paidAt,
          updatedById: (session.user as any).id,
        },
      })

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

