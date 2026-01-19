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

    // Usar credenciales globales de Mercado Pago (Clivaro)
    const mercadoPagoAccessToken = process.env.MERCADOPAGO_ACCESS_TOKEN
    
    if (!mercadoPagoAccessToken) {
      logger.error('Mercado Pago not configured in environment variables')
      return NextResponse.json(
        { error: 'Mercado Pago no está configurado' },
        { status: 500 }
      )
    }

    // Buscar en todas las suscripciones (Mercado Pago solo se usa para suscripciones)
    const subscription = await executeWithRetry(() => prisma.subscription.findFirst({
      where: {
        OR: [
          { mercadoPagoPaymentId: paymentId },
          { mercadoPagoPreferenceId: paymentId },
        ],
      },
      include: {
        plan: true,
        tenant: true,
      },
    }))

    if (subscription) {
      // Obtener información actualizada del pago desde Mercado Pago
      const paymentInfo = await getPaymentInfo(
        {
          accessToken: mercadoPagoAccessToken,
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

      await executeWithRetry(() => prisma.subscription.update({
        where: { id: subscription.id },
        data: updateData,
      }))

      logger.info('Subscription updated from Mercado Pago payment', {
        subscriptionId: subscription.id,
        status: paymentInfo.status,
        amount: subscription.plan.price,
      })

      return NextResponse.json({ received: true, processed: true, type: 'subscription' })
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

