import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getTenantPrisma } from '@/lib/tenant-db'
import { processWebhookNotification, getPaymentInfo } from '@/lib/mercadopago'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

/**
 * POST /api/payments/mercadopago/webhook
 * Webhook para recibir notificaciones de Mercado Pago
 */
export async function POST(request: Request) {
  try {
    const body = await request.json()
    
    // Mercado Pago envía notificaciones en formato:
    // { type: "payment", data: { id: "123456789" } }
    const notification = body as {
      type: string
      action?: string
      data: {
        id: string
      }
    }

    if (notification.type !== 'payment') {
      return NextResponse.json({ received: true })
    }

    const paymentId = notification.data.id

    // Buscar el pago en todas las bases de datos de tenants
    // Primero, intentamos encontrar el pago por mercadoPagoPaymentId
    const tenants = await prisma.tenant.findMany({
      where: { active: true },
      include: {
        settings: true,
      },
    })

    for (const tenant of tenants) {
      if (!tenant.settings?.mercadoPagoEnabled || !tenant.settings?.mercadoPagoAccessToken) {
        continue
      }

      // Primero buscar en suscripciones (prioridad)
      const subscription = await prisma.subscription.findFirst({
        where: {
          tenantId: tenant.id,
          OR: [
            { mercadoPagoPaymentId: paymentId },
            { mercadoPagoPreferenceId: paymentId },
          ],
        },
        include: {
          plan: true,
        },
      })

      if (subscription) {
        // Obtener información actualizada del pago desde Mercado Pago
        const paymentInfo = await getPaymentInfo(
          {
            accessToken: tenant.settings.mercadoPagoAccessToken!,
          },
          paymentId
        )

        // Actualizar la suscripción con la información de Mercado Pago
        const updateData: any = {
          mercadoPagoPaymentId: paymentInfo.id ? paymentInfo.id.toString() : paymentId,
          mercadoPagoStatus: paymentInfo.status,
          mercadoPagoStatusDetail: paymentInfo.statusDetail,
          mercadoPagoPaymentMethod: paymentInfo.paymentMethodId,
          mercadoPagoTransactionId: paymentInfo.id ? paymentInfo.id.toString() : paymentId,
          mercadoPagoResponse: JSON.stringify(paymentInfo),
          updatedAt: new Date(),
        }

        // Si el pago fue aprobado, activar la suscripción
        if (paymentInfo.status === 'approved') {
          const now = new Date()
          const interval = subscription.plan.interval === 'annual' ? 365 : 30
          const endDate = new Date(now)
          endDate.setDate(endDate.getDate() + interval)

          updateData.status = 'active'
          updateData.startDate = now
          updateData.endDate = endDate
        }

        await prisma.subscription.update({
          where: { id: subscription.id },
          data: updateData,
        })

        logger.info('Subscription updated from Mercado Pago payment', {
          subscriptionId: subscription.id,
          status: paymentInfo.status,
          amount: subscription.plan.price,
        })

        return NextResponse.json({ received: true, processed: true, type: 'subscription' })
      }

      // Si no es una suscripción, buscar en pagos de facturas (legacy, mantener por compatibilidad)
      const tenantPrisma = getTenantPrisma(tenant.databaseUrl)
      
      const payment = await tenantPrisma.payment.findFirst({
        where: {
          OR: [
            { mercadoPagoPaymentId: paymentId },
            { mercadoPagoPreferenceId: paymentId },
          ],
        },
        include: {
          invoice: true,
        },
      })

      if (payment) {
        // Obtener información actualizada del pago desde Mercado Pago
        const paymentInfo = await getPaymentInfo(
          {
            accessToken: tenant.settings.mercadoPagoAccessToken!,
          },
          paymentId
        )

        // Actualizar el pago con la información de Mercado Pago
        await tenantPrisma.payment.update({
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

        // Si el pago fue aprobado, actualizar el estado de la factura
        if (paymentInfo.status === 'approved') {
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

          logger.info('Invoice updated from Mercado Pago payment', {
            invoiceId: invoice.id,
            paymentId: payment.id,
            status: newStatus,
            amount: payment.amount,
          })
        }

        return NextResponse.json({ received: true, processed: true, type: 'invoice' })
      }
    }

    // Si no encontramos el pago, aún respondemos OK para evitar reintentos
    logger.warn('Mercado Pago payment not found in any tenant', {
      paymentId,
    })

    return NextResponse.json({ received: true, processed: false })
  } catch (error: any) {
    logger.error('Error processing Mercado Pago webhook', error, {
      endpoint: '/api/payments/mercadopago/webhook',
      method: 'POST',
    })
    
    // Respondemos 200 para evitar que Mercado Pago reintente inmediatamente
    // pero logueamos el error para debugging
    return NextResponse.json(
      { received: true, error: 'Internal error' },
      { status: 200 }
    )
  }
}

/**
 * GET /api/payments/mercadopago/webhook
 * Endpoint para verificar que el webhook está funcionando
 */
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    message: 'Mercado Pago webhook endpoint is active',
  })
}

