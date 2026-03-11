import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-middleware'
import { withTenantTx, getTenantIdFromSession } from '@/lib/tenancy'
import { getPaymentInfo } from '@/lib/mercadopago'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

export async function GET(
  request: Request,
  { params }: { params: { paymentId: string } | Promise<{ paymentId: string }> }
) {
  try {
    const resolvedParams = await Promise.resolve(params)
    const paymentId = resolvedParams.paymentId

    const session = await requireAuth(request)
    if (session instanceof NextResponse) return session

    const tenantId = getTenantIdFromSession(session)
    const user = session.user as any

    if (user.isSuperAdmin) {
      return NextResponse.json({ error: 'Super admin no puede consultar pagos de tenant' }, { status: 403 })
    }

    const mercadoPagoAccessToken = process.env.MERCADOPAGO_ACCESS_TOKEN?.trim()
    if (!mercadoPagoAccessToken) {
      return NextResponse.json({ error: 'Mercado Pago no configurado' }, { status: 500 })
    }

    const result = await withTenantTx(tenantId, async (prisma) => {
      const payment = await prisma.payment.findUnique({
        where: { id: paymentId },
        include: { invoice: true },
      })

      if (!payment) throw new Error('Pago no encontrado')
      if (!payment.mercadoPagoPaymentId && !payment.mercadoPagoPreferenceId) {
        throw new Error('Este pago no es de Mercado Pago')
      }

      const mpPaymentId = payment.mercadoPagoPaymentId || payment.mercadoPagoPreferenceId!
      const paymentInfo = await getPaymentInfo({ accessToken: mercadoPagoAccessToken }, mpPaymentId)

      const updatedPayment = await prisma.payment.update({
        where: { id: payment.id },
        data: {
          mercadoPagoPaymentId: paymentInfo.id ? paymentInfo.id.toString() : paymentId,
          mercadoPagoStatus: paymentInfo.status,
          mercadoPagoStatusDetail: paymentInfo.statusDetail,
          mercadoPagoPaymentMethod: paymentInfo.paymentMethodId,
          mercadoPagoTransactionId: paymentInfo.id ? paymentInfo.id.toString() : paymentId,
          mercadoPagoResponse: JSON.stringify(paymentInfo),
          updatedAt: new Date(),
        },
      })

      if (paymentInfo.status === 'approved' && payment.invoice.status !== 'PAGADA') {
        const totalPaid = await prisma.payment.aggregate({
          where: { invoiceId: payment.invoiceId },
          _sum: { amount: true },
        })

        const newTotalPaid = totalPaid._sum.amount || 0
        let newStatus = 'EMITIDA'
        if (newTotalPaid >= payment.invoice.total) newStatus = 'PAGADA'
        else if (newTotalPaid > 0) newStatus = 'EN_COBRANZA'

        await prisma.invoice.update({
          where: { id: payment.invoiceId },
          data: {
            status: newStatus as any,
            paidAt: newStatus === 'PAGADA' ? new Date() : payment.invoice.paidAt,
          },
        })
      }

      return { updatedPayment, paymentInfo }
    })

    return NextResponse.json({
      payment: result.updatedPayment,
      mercadoPagoStatus: result.paymentInfo.status,
      mercadoPagoStatusDetail: result.paymentInfo.statusDetail,
    })
  } catch (error: any) {
    logger.error('Error getting Mercado Pago payment status', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

