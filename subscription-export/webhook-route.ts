import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { logger } from '@/lib/logger'
import { MercadoPagoConfig, Payment, PreApproval } from 'mercadopago'

export const dynamic = 'force-dynamic'

// Función helper para ejecutar consultas con retry
async function executeWithRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 5,
  delay = 2000
): Promise<T> {
  let lastError: any
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error: any) {
      lastError = error
      const errorMessage = error?.message || String(error)
      
      if (errorMessage.includes('MaxClientsInSessionMode') || errorMessage.includes('max clients reached')) {
        if (attempt < maxRetries - 1) {
          const backoffDelay = Math.min(delay * Math.pow(2, attempt), 15000)
          await new Promise(resolve => setTimeout(resolve, backoffDelay))
          continue
        }
      }
      throw error
    }
  }
  throw lastError
}

/**
 * POST /api/payments/mercadopago/webhook
 * Webhook para recibir notificaciones de Mercado Pago sobre pagos y suscripciones
 */
export async function POST(request: Request) {
  try {
    const body = await request.json()
    
    logger.info('Mercado Pago webhook received', {
      type: body.type,
      action: body.action,
      data: body.data,
    })

    // Verificar credenciales de Mercado Pago
    const mercadoPagoAccessToken = process.env.MERCADOPAGO_ACCESS_TOKEN?.trim()
    if (!mercadoPagoAccessToken) {
      logger.error('Mercado Pago not configured in webhook')
      return NextResponse.json(
        { error: 'Mercado Pago no está configurado' },
        { status: 500 }
      )
    }

    const client = new MercadoPagoConfig({ accessToken: mercadoPagoAccessToken })
    const payment = new Payment(client)
    const preApproval = new PreApproval(client)

    // Procesar diferentes tipos de notificaciones
    if (body.type === 'payment') {
      // Notificación de pago (pago recurrente procesado)
      const paymentId = body.data?.id

      if (!paymentId) {
        logger.warn('Payment notification without payment ID')
        return NextResponse.json({ received: true })
      }

      // Obtener información del pago desde Mercado Pago
      let paymentInfo: any = null
      try {
        paymentInfo = await payment.get({ id: paymentId })
      } catch (error: any) {
        logger.error('Error fetching payment info from Mercado Pago', error, {
          paymentId,
        })
        return NextResponse.json({ received: true }) // Responder OK para evitar reintentos
      }

      // Buscar suscripción por external_reference o payment_id
      const externalReference = paymentInfo.external_reference
      const subscription = await executeWithRetry(() => prisma.subscription.findFirst({
        where: {
          OR: [
            { mercadoPagoPaymentId: paymentId.toString() },
            { mercadoPagoPreferenceId: externalReference || '' },
            // Buscar por tenantId si el external_reference contiene el tenantId
            ...(externalReference?.includes('subscription_') ? [
              { id: externalReference.split('_')[1] || '' },
            ] : []),
          ],
        },
        include: {
          plan: true,
          tenant: true,
        },
      }))

      if (subscription) {
        // Actualizar suscripción con información del pago
        const updateData: any = {
          mercadoPagoPaymentId: paymentId.toString(),
          mercadoPagoStatus: paymentInfo.status || null,
          mercadoPagoStatusDetail: paymentInfo.status_detail || null,
          mercadoPagoPaymentMethod: paymentInfo.payment_method_id || null,
          mercadoPagoTransactionId: paymentInfo.transaction_details?.transaction_id || null,
          mercadoPagoResponse: JSON.stringify(paymentInfo),
          updatedAt: new Date(),
        }

        // Si el pago fue aprobado, actualizar fechas y estado
        if (paymentInfo.status === 'approved') {
          const now = new Date()
          const interval = subscription.plan.interval === 'annual' ? 365 : 30

          // Calcular nueva fecha de fin
          let baseDate = now
          if (subscription.endDate) {
            const currentEndDate = new Date(subscription.endDate)
            if (currentEndDate > now) {
              baseDate = currentEndDate // Extender desde la fecha actual de fin
            }
          }

          const newEndDate = new Date(baseDate)
          if (subscription.plan.interval === 'annual') {
            newEndDate.setFullYear(newEndDate.getFullYear() + 1)
          } else {
            newEndDate.setMonth(newEndDate.getMonth() + 1)
          }

          updateData.status = 'active'
          updateData.startDate = subscription.startDate || now
          updateData.endDate = newEndDate

          // Validar monto (con tolerancia del 1%)
          if (paymentInfo.transaction_amount && subscription.plan.price) {
            const expectedAmount = subscription.plan.price
            const receivedAmount = paymentInfo.transaction_amount
            const tolerance = expectedAmount * 0.01

            if (Math.abs(receivedAmount - expectedAmount) > tolerance) {
              logger.warn('Payment amount mismatch', {
                subscriptionId: subscription.id,
                expectedAmount,
                receivedAmount,
                difference: Math.abs(receivedAmount - expectedAmount),
              })
            }
          }
        } else if (paymentInfo.status === 'pending' || paymentInfo.status === 'in_process') {
          updateData.status = 'pending_payment'
        } else if (paymentInfo.status === 'rejected' || paymentInfo.status === 'cancelled') {
          // Mantener como pending_payment para que pueda reintentar
          updateData.status = 'pending_payment'
        }

        await executeWithRetry(() => prisma.subscription.update({
          where: { id: subscription.id },
          data: updateData,
        }))

        logger.info('Subscription updated from payment webhook', {
          subscriptionId: subscription.id,
          paymentId,
          status: paymentInfo.status,
        })
      } else {
        logger.warn('Payment notification for unknown subscription', {
          paymentId,
          externalReference,
        })
      }

      return NextResponse.json({ received: true, processed: true })
    }

    if (body.type === 'subscription_preapproval') {
      // Notificación de cambio en Preapproval (suscripción)
      const preapprovalId = body.data?.id

      if (!preapprovalId) {
        logger.warn('Preapproval notification without ID')
        return NextResponse.json({ received: true })
      }

      // Obtener información del Preapproval
      let preapprovalInfo: any = null
      try {
        preapprovalInfo = await preApproval.get({ id: preapprovalId })
      } catch (error: any) {
        logger.error('Error fetching preapproval info from Mercado Pago', error, {
          preapprovalId,
        })
        return NextResponse.json({ received: true })
      }

      // Buscar suscripción por Preapproval ID
      const subscription = await executeWithRetry(() => prisma.subscription.findFirst({
        where: {
          mercadoPagoPreferenceId: preapprovalId.toString(),
        },
        include: {
          plan: true,
        },
      }))

      if (subscription) {
        // Actualizar estado de la suscripción según el estado del Preapproval
        const updateData: any = {
          mercadoPagoStatus: preapprovalInfo.status || null,
          mercadoPagoResponse: JSON.stringify(preapprovalInfo),
          updatedAt: new Date(),
        }

        if (preapprovalInfo.status === 'cancelled' || preapprovalInfo.status === 'paused') {
          updateData.status = 'cancelled'
          updateData.autoRenew = false
        } else if (preapprovalInfo.status === 'authorized') {
          updateData.status = 'active'
        }

        await executeWithRetry(() => prisma.subscription.update({
          where: { id: subscription.id },
          data: updateData,
        }))

        logger.info('Subscription updated from preapproval webhook', {
          subscriptionId: subscription.id,
          preapprovalId,
          status: preapprovalInfo.status,
        })
      }

      return NextResponse.json({ received: true, processed: true })
    }

    // Si no es un tipo conocido, responder OK para evitar reintentos
    logger.info('Unknown webhook notification type', {
      type: body.type,
    })

    return NextResponse.json({ received: true })
  } catch (error: any) {
    logger.error('Error processing Mercado Pago webhook', error, {
      endpoint: '/api/payments/mercadopago/webhook',
      method: 'POST',
    })

    // Responder 200 para evitar que Mercado Pago reintente inmediatamente
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
