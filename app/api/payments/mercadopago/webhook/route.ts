import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getTenantPrisma } from '@/lib/tenant-db'
import { processWebhookNotification, getPaymentInfo } from '@/lib/mercadopago'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

// Función helper para ejecutar consultas con retry y manejo de errores de conexión
async function executeWithRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  delay = 1000
): Promise<T> {
  let lastError: any
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error: any) {
      lastError = error
      const errorMessage = error?.message || String(error)
      
      // Si es error de límite de conexiones, esperar y reintentar
      if (errorMessage.includes('MaxClientsInSessionMode') || errorMessage.includes('max clients reached')) {
        if (attempt < maxRetries - 1) {
          const backoffDelay = Math.min(delay * Math.pow(2, attempt), 10000) // Backoff exponencial, max 10s
          logger.warn(`[Mercado Pago Webhook] Límite de conexiones alcanzado, reintentando en ${backoffDelay}ms (intento ${attempt + 1}/${maxRetries})`)
          await new Promise(resolve => setTimeout(resolve, backoffDelay))
          continue
        }
      }
      
      // Si no es error de conexión, lanzar inmediatamente
      throw error
    }
  }
  throw lastError
}

/**
 * POST /api/payments/mercadopago/webhook
 * Webhook para recibir notificaciones de Mercado Pago
 */
export async function POST(request: Request) {
  try {
    const body = await request.json()
    
    logger.info('Mercado Pago webhook received', {
      body: JSON.stringify(body),
      headers: Object.fromEntries(request.headers.entries()),
    })
    
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
      logger.info('Webhook notification type is not payment, ignoring', {
        type: notification.type,
      })
      return NextResponse.json({ received: true })
    }

    const paymentId = notification.data.id

    // Usar credenciales globales de Mercado Pago (Clivaro)
    const mercadoPagoAccessToken = process.env.MERCADOPAGO_ACCESS_TOKEN
    
    if (!mercadoPagoAccessToken) {
      logger.error('Mercado Pago not configured in environment variables')
      return NextResponse.json(
        { error: 'Mercado Pago no está configurado' },
        { status: 500 }
      )
    }

    // Primero obtener la información del pago desde Mercado Pago para obtener el external_reference
    type PaymentInfo = {
      id: string | null
      status: string | null
      statusDetail: string | null
      paymentMethodId: string | null
      paymentTypeId: string | null
      transactionAmount: number | null
      currencyId: string | null
      dateCreated: string | null
      dateApproved: string | null
      dateLastUpdated: string | null
      externalReference: string | null
      payer: any
      metadata: any
    }
    
    let paymentInfo: PaymentInfo | null = null
    try {
      paymentInfo = await getPaymentInfo(
        {
          accessToken: mercadoPagoAccessToken,
        },
        paymentId
      )
    } catch (error: any) {
      logger.error('Error fetching payment info from Mercado Pago', error, {
        paymentId,
      })
      // Continuar intentando buscar por paymentId directamente
    }

    // Buscar la suscripción por múltiples criterios:
    // 1. Por paymentId (si ya está guardado)
    // 2. Por preferenceId (si el paymentId es en realidad un preferenceId)
    // 3. Por external_reference del pago (subscriptionId)
    const subscription = await executeWithRetry(() => prisma.subscription.findFirst({
      where: {
        OR: [
          { mercadoPagoPaymentId: paymentId },
          { mercadoPagoPreferenceId: paymentId },
          // Si tenemos el external_reference del pago, buscarlo
          ...(paymentInfo?.externalReference ? [{ id: paymentInfo.externalReference }] : []),
        ],
      },
      include: {
        plan: true,
        tenant: true,
      },
    }))

    if (subscription) {
      // Si no obtuvimos la información del pago antes, obtenerla ahora
      if (!paymentInfo) {
        try {
          paymentInfo = await getPaymentInfo(
            {
              accessToken: mercadoPagoAccessToken,
            },
            paymentId
          )
        } catch (error: any) {
          logger.error('Error fetching payment info in subscription update', error, {
            paymentId,
            subscriptionId: subscription.id,
          })
          // Continuar con la información que tenemos
        }
      }

      // Actualizar la suscripción con la información de Mercado Pago
      // Procesar TODOS los estados: approved, pending, rejected, cancelled, refunded, etc.
      const updateData: any = {
        mercadoPagoPaymentId: paymentInfo?.id ? paymentInfo.id.toString() : paymentId,
        mercadoPagoStatus: paymentInfo?.status || 'pending',
        mercadoPagoStatusDetail: paymentInfo?.statusDetail || null,
        mercadoPagoPaymentMethod: paymentInfo?.paymentMethodId || null,
        mercadoPagoTransactionId: paymentInfo?.id ? paymentInfo.id.toString() : paymentId,
        mercadoPagoResponse: paymentInfo ? JSON.stringify(paymentInfo) : null,
        updatedAt: new Date(),
      }

      // Manejar diferentes estados del pago
      if (paymentInfo?.status === 'approved') {
        // Pago aprobado: activar la suscripción
        const now = new Date()
        const interval = subscription.plan.interval === 'annual' ? 365 : 30
        const endDate = new Date(now)
        endDate.setDate(endDate.getDate() + interval)

        updateData.status = 'active'
        updateData.startDate = subscription.startDate || now
        updateData.endDate = subscription.endDate ? 
          new Date(Math.max(new Date(subscription.endDate).getTime(), endDate.getTime())) : 
          endDate
      } else if (paymentInfo?.status === 'pending' || paymentInfo?.status === 'in_process') {
        // Pago pendiente: mantener estado pending_payment
        updateData.status = 'pending_payment'
      } else if (paymentInfo?.status === 'rejected' || paymentInfo?.status === 'cancelled') {
        // Pago rechazado o cancelado: mantener estado pero registrar el rechazo
        updateData.status = 'pending_payment' // Mantener como pendiente para que pueda reintentar
      } else if (paymentInfo?.status === 'refunded' || paymentInfo?.status === 'charged_back') {
        // Pago reembolsado: mantener la suscripción activa pero registrar el reembolso
        // No cambiar el status de la suscripción, solo registrar el estado del pago
      }

      await executeWithRetry(() => prisma.subscription.update({
        where: { id: subscription.id },
        data: updateData,
      }))

      logger.info('Subscription updated from Mercado Pago payment webhook', {
        subscriptionId: subscription.id,
        paymentId,
        status: paymentInfo?.status || 'unknown',
        statusDetail: paymentInfo?.statusDetail || null,
        amount: subscription.plan.price,
      })

      return NextResponse.json({ 
        received: true, 
        processed: true, 
        type: 'subscription',
        subscriptionId: subscription.id,
        paymentStatus: paymentInfo?.status || 'unknown',
      })
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

