import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-middleware'
import { prisma } from '@/lib/db'
import { getPrismaForRequest } from '@/lib/get-tenant-prisma'
import { getPaymentInfo } from '@/lib/mercadopago'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

/**
 * GET /api/payments/mercadopago/status/[paymentId]
 * Obtiene el estado actualizado de un pago de Mercado Pago
 */
export async function GET(
  request: Request,
  { params }: { params: { paymentId: string } | Promise<{ paymentId: string }> }
) {
  try {
    const resolvedParams = await Promise.resolve(params)
    const paymentId = resolvedParams.paymentId

    const session = await requireAuth(request)
    
    if (session instanceof NextResponse) {
      return session
    }

    const user = session.user as any
    
    if (user.isSuperAdmin) {
      return NextResponse.json(
        { error: 'Super admin no puede consultar pagos de tenant' },
        { status: 403 }
      )
    }

    if (!user.tenantId) {
      return NextResponse.json(
        { error: 'Usuario no tiene tenant asociado' },
        { status: 400 }
      )
    }

    // Obtener configuración de Mercado Pago
    const settings = await prisma.tenantSettings.findUnique({
      where: { tenantId: user.tenantId },
    })

    if (!settings?.mercadoPagoEnabled || !settings?.mercadoPagoAccessToken) {
      return NextResponse.json(
        { error: 'Mercado Pago no está configurado' },
        { status: 400 }
      )
    }

    // Obtener el pago
    const tenantPrisma = await getPrismaForRequest(request, session)
    const payment = await tenantPrisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        invoice: true,
      },
    })

    if (!payment) {
      return NextResponse.json(
        { error: 'Pago no encontrado' },
        { status: 404 }
      )
    }

    if (!payment.mercadoPagoPaymentId && !payment.mercadoPagoPreferenceId) {
      return NextResponse.json(
        { error: 'Este pago no es de Mercado Pago' },
        { status: 400 }
      )
    }

    // Obtener información actualizada desde Mercado Pago
    try {
      const mpPaymentId = payment.mercadoPagoPaymentId || payment.mercadoPagoPreferenceId!
      const paymentInfo = await getPaymentInfo(
        {
          accessToken: settings.mercadoPagoAccessToken!,
        },
        mpPaymentId
      )

      // Actualizar el pago local con la información más reciente
      const updatedPayment = await tenantPrisma.payment.update({
        where: { id: payment.id },
        data: {
          mercadoPagoPaymentId: paymentInfo.id.toString(),
          mercadoPagoStatus: paymentInfo.status,
          mercadoPagoStatusDetail: paymentInfo.statusDetail,
          mercadoPagoPaymentMethod: paymentInfo.paymentMethodId,
          mercadoPagoTransactionId: paymentInfo.id.toString(),
          mercadoPagoResponse: JSON.stringify(paymentInfo),
          updatedAt: new Date(),
        },
      })

      // Si el pago fue aprobado, actualizar el estado de la factura
      if (paymentInfo.status === 'approved' && payment.invoice.status !== 'PAGADA') {
        const invoice = payment.invoice
        
        // Calcular el total pagado
        const totalPaid = await tenantPrisma.payment.aggregate({
          where: { invoiceId: invoice.id },
          _sum: { amount: true },
        })

        const newTotalPaid = totalPaid._sum.amount || 0

        // Determinar el nuevo estado
        let newStatus: string
        if (newTotalPaid >= invoice.total) {
          newStatus = 'PAGADA'
        } else if (newTotalPaid > 0) {
          newStatus = 'EN_COBRANZA'
        } else {
          newStatus = 'EMITIDA'
        }

        await tenantPrisma.invoice.update({
          where: { id: invoice.id },
          data: {
            status: newStatus,
            paidAt: newStatus === 'PAGADA' ? new Date() : invoice.paidAt,
          },
        })
      }

      return NextResponse.json({
        payment: updatedPayment,
        mercadoPagoStatus: paymentInfo.status,
        mercadoPagoStatusDetail: paymentInfo.statusDetail,
        invoiceStatus: payment.invoice.status,
      })
    } catch (error: any) {
      // Si hay error al obtener de MP, devolver el estado local
      logger.warn('Error getting payment info from Mercado Pago', error, {
        paymentId: payment.id,
      })
      
      return NextResponse.json({
        payment,
        mercadoPagoStatus: payment.mercadoPagoStatus,
        mercadoPagoStatusDetail: payment.mercadoPagoStatusDetail,
        invoiceStatus: payment.invoice.status,
        note: 'Estado local (no se pudo actualizar desde Mercado Pago)',
      })
    }
  } catch (error: any) {
    logger.error('Error getting Mercado Pago payment status', error, {
      endpoint: '/api/payments/mercadopago/status',
      method: 'GET',
    })
    return NextResponse.json(
      { error: 'Error al obtener estado del pago', details: error?.message || String(error) },
      { status: 500 }
    )
  }
}

