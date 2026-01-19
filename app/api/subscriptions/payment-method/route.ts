import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-middleware'
import { prisma } from '@/lib/db'
import { Payment } from 'mercadopago'
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
          logger.warn(`[Payment Method] Límite de conexiones alcanzado, reintentando en ${backoffDelay}ms (intento ${attempt + 1}/${maxRetries})`)
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
 * GET /api/subscriptions/payment-method
 * Obtiene la public key de Mercado Pago para inicializar el SDK en el frontend
 */
export async function GET(request: Request) {
  try {
    const session = await requireAuth(request)
    
    if (session instanceof NextResponse) {
      return session
    }

    const mercadoPagoPublicKey = process.env.MERCADOPAGO_PUBLIC_KEY
    
    if (!mercadoPagoPublicKey) {
      return NextResponse.json(
        { error: 'Mercado Pago no está configurado' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      publicKey: mercadoPagoPublicKey,
    })
  } catch (error: any) {
    logger.error('Error getting Mercado Pago public key', error)
    return NextResponse.json(
      { error: 'Error al obtener configuración de pago' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/subscriptions/payment-method
 * Procesa un pago con tarjeta y actualiza el método de pago de la suscripción
 */
export async function POST(request: Request) {
  try {
    const session = await requireAuth(request)
    
    if (session instanceof NextResponse) {
      return session
    }

    const user = session.user as any
    
    if (user.isSuperAdmin) {
      return NextResponse.json(
        { error: 'Super admin no puede procesar pagos de tenant' },
        { status: 403 }
      )
    }

    if (!user.tenantId) {
      return NextResponse.json(
        { error: 'Usuario no tiene tenant asociado' },
        { status: 400 }
      )
    }

    const body = await request.json()
    const { subscriptionId, token, paymentMethodId, installments, issuerId } = body

    if (!subscriptionId || !token) {
      return NextResponse.json(
        { error: 'subscriptionId y token son requeridos' },
        { status: 400 }
      )
    }

    // Obtener la suscripción
    const subscription = await executeWithRetry(() => prisma.subscription.findUnique({
      where: { id: subscriptionId },
      include: {
        plan: true,
        tenant: true,
      },
    }))

    if (!subscription) {
      return NextResponse.json(
        { error: 'Suscripción no encontrada' },
        { status: 404 }
      )
    }

    // Verificar que la suscripción pertenece al tenant del usuario
    if (subscription.tenantId !== user.tenantId) {
      return NextResponse.json(
        { error: 'No tienes permiso para procesar este pago' },
        { status: 403 }
      )
    }

    // Verificar que Mercado Pago está configurado
    const mercadoPagoAccessToken = process.env.MERCADOPAGO_ACCESS_TOKEN
    
    if (!mercadoPagoAccessToken) {
      return NextResponse.json(
        { error: 'Mercado Pago no está configurado. Contacta al administrador.' },
        { status: 500 }
      )
    }

    // Procesar el pago con Mercado Pago
    const { MercadoPagoConfig, Payment } = await import('mercadopago')
    
    const client = new MercadoPagoConfig({ accessToken: mercadoPagoAccessToken })
    const payment = new Payment(client)

    const paymentData = {
      transaction_amount: subscription.plan.price,
      token: token,
      description: `Pago de suscripción ${subscription.plan.name}`,
      installments: installments || 1,
      payment_method_id: paymentMethodId,
      issuer_id: issuerId,
      payer: {
        email: subscription.tenant.email || undefined,
      },
      external_reference: subscription.id,
    }

    const paymentResult = await payment.create({ body: paymentData })

    // Actualizar la suscripción con la información del pago
    const updatedSubscription = await executeWithRetry(() => prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        mercadoPagoPaymentId: paymentResult.id?.toString() || null,
        mercadoPagoStatus: paymentResult.status || null,
        mercadoPagoStatusDetail: paymentResult.status_detail || null,
        mercadoPagoPaymentMethod: paymentResult.payment_method_id || null,
        mercadoPagoTransactionId: paymentResult.transaction_details?.transaction_id || null,
        mercadoPagoResponse: JSON.stringify(paymentResult),
        status: paymentResult.status === 'approved' ? 'active' : 'pending_payment',
        // Si el pago fue aprobado, extender la fecha de fin
        ...(paymentResult.status === 'approved' && subscription.endDate && {
          endDate: new Date(subscription.endDate.getTime() + (subscription.plan.interval === 'monthly' ? 30 : 365) * 24 * 60 * 60 * 1000),
        }),
      },
    }))

    logger.info('Mercado Pago subscription payment processed', {
      subscriptionId: subscription.id,
      paymentId: paymentResult.id,
      status: paymentResult.status,
      planName: subscription.plan.name,
    })

    return NextResponse.json({
      success: paymentResult.status === 'approved',
      payment: {
        id: paymentResult.id,
        status: paymentResult.status,
        statusDetail: paymentResult.status_detail,
        paymentMethodId: paymentResult.payment_method_id,
      },
      subscription: updatedSubscription,
    })
  } catch (error: any) {
    logger.error('Error processing Mercado Pago payment', error, {
      endpoint: '/api/subscriptions/payment-method',
      method: 'POST',
    })
    return NextResponse.json(
      { 
        error: 'Error al procesar el pago', 
        details: error?.message || String(error),
        code: error?.code || 'UNKNOWN_ERROR',
      },
      { status: 500 }
    )
  }
}

