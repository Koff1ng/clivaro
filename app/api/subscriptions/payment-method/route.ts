import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-middleware'
import { prisma } from '@/lib/db'
import { Payment } from 'mercadopago'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

// Función helper para obtener mensajes amigables de rechazo de Mercado Pago
function getRejectionReasonMessage(statusDetail: string): string {
  const rejectionMessages: Record<string, string> = {
    'cc_rejected_other_reason': 'La tarjeta fue rechazada. Si estás usando una tarjeta de prueba, usa: Número 5031 7557 3453 0604, CVV 123, Vencimiento 11/25, Nombre APRO. Verifica que estés usando credenciales de prueba (TEST-) en Vercel.',
    'cc_rejected_insufficient_amount': 'La tarjeta no tiene fondos suficientes.',
    'cc_rejected_bad_filled_card_number': 'El número de tarjeta es incorrecto.',
    'cc_rejected_bad_filled_date': 'La fecha de vencimiento es incorrecta.',
    'cc_rejected_bad_filled_other': 'Algunos datos de la tarjeta son incorrectos.',
    'cc_rejected_call_for_authorize': 'Debes autorizar el pago con tu banco.',
    'cc_rejected_card_error': 'Error con la tarjeta. Verifica los datos.',
    'cc_rejected_high_risk': 'El pago fue rechazado por medidas de seguridad.',
    'cc_rejected_insufficient_data': 'Faltan datos de la tarjeta.',
    'cc_rejected_invalid_installments': 'El número de cuotas no es válido.',
    'cc_rejected_max_attempts': 'Se excedió el número de intentos permitidos.',
    'cc_rejected_card_type_not_allowed': 'Este tipo de tarjeta no está permitido.',
  }
  
  return rejectionMessages[statusDetail] || `El pago fue rechazado: ${statusDetail}. Verifica los datos de la tarjeta o intenta con otro medio de pago.`
}

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
    const { subscriptionId, token, paymentMethodId, installments, issuerId, identificationType, identificationNumber, email } = body

    if (!subscriptionId || !token) {
      return NextResponse.json(
        { error: 'subscriptionId y token son requeridos' },
        { status: 400 }
      )
    }

    // Validar campos de identificación (obligatorios para Colombia)
    if (!identificationType || !identificationNumber) {
      return NextResponse.json(
        { error: 'Tipo y número de documento son requeridos para pagos en Colombia' },
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
    // Limpiar espacios y saltos de línea del token
    const mercadoPagoAccessToken = process.env.MERCADOPAGO_ACCESS_TOKEN?.trim()
    
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
        // Usar el email del formulario si está disponible, sino el del tenant
        email: email || subscription.tenant.email || undefined,
        // Identificación obligatoria para Colombia
        identification: {
          type: identificationType,
          number: identificationNumber.trim(),
        },
      },
      external_reference: subscription.id,
      statement_descriptor: `CLIVARO ${subscription.plan.name.substring(0, 12)}`, // Máximo 13 caracteres
    }

    logger.info('Creating Mercado Pago payment', {
      subscriptionId: subscription.id,
      amount: paymentData.transaction_amount,
      hasToken: !!token,
      paymentMethodId,
      installments: paymentData.installments,
    })

    let paymentResult
    try {
      paymentResult = await payment.create({ body: paymentData })
      
      // Verificar si el pago fue rechazado aunque no haya lanzado error
      if (paymentResult.status === 'rejected') {
        const statusDetail = paymentResult.status_detail || 'cc_rejected_other_reason'
        const rejectionReason = getRejectionReasonMessage(statusDetail)
        
        logger.warn('Mercado Pago payment rejected', {
          subscriptionId: subscription.id,
          paymentId: paymentResult.id,
          status: paymentResult.status,
          statusDetail: statusDetail,
          rejectionReason,
        })

        return NextResponse.json(
          {
            error: rejectionReason,
            code: 'PAYMENT_REJECTED',
            mercadoPagoStatus: paymentResult.status,
            statusDetail: statusDetail,
          },
          { status: 400 }
        )
      }
    } catch (mpError: any) {
      // Error devuelto por la API de Mercado Pago
      const mpMessage = mpError?.message || String(mpError)
      const mpStatus = mpError?.status || mpError?.statusCode
      const mpCode = mpError?.code || 'MERCADOPAGO_ERROR'
      const mpCause = mpError?.cause
      const mpStatusDetail = mpError?.status_detail || mpError?.statusDetail

      logger.error('Mercado Pago payment creation failed', mpError, {
        subscriptionId: subscription.id,
        errorMessage: mpMessage,
        errorStatus: mpStatus,
        errorCode: mpCode,
        errorCause: mpCause,
        statusDetail: mpStatusDetail,
        paymentData: {
          ...paymentData,
          token: token ? `${token.substring(0, 10)}...` : null, // Solo mostrar parte del token por seguridad
        },
      })

      // Preparar mensaje amigable para el usuario según las causas de MP
      let userMessage = 'El pago fue rechazado por Mercado Pago. Verifica los datos de la tarjeta o intenta con otro medio de pago.'

      // Si hay un status_detail, usarlo para dar un mensaje más específico
      if (mpStatusDetail) {
        userMessage = getRejectionReasonMessage(mpStatusDetail)
      }
      // Si Mercado Pago envía causas detalladas, usarlas
      else if (Array.isArray(mpCause) && mpCause.length > 0) {
        const first = mpCause[0]
        if (first?.description) {
          userMessage = `El pago fue rechazado por Mercado Pago: ${first.description}`
        }
      }

      return NextResponse.json(
        {
          error: userMessage,
          code: mpCode,
          mercadoPagoStatus: mpStatus,
          statusDetail: mpStatusDetail,
          cause: Array.isArray(mpCause) ? mpCause : undefined,
        },
        { status: 400 }
      )
    }

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
        // Si el pago fue aprobado, calcular la nueva fecha de fin
        ...(paymentResult.status === 'approved' && (() => {
          const now = new Date()
          const interval = subscription.plan.interval === 'monthly' ? 30 : 365
          
          // Si la suscripción ya tiene un endDate futuro, extender desde ahí
          // Si no tiene endDate o está en el pasado, crear uno nuevo desde ahora
          let baseDate = now
          if (subscription.endDate) {
            const currentEndDate = new Date(subscription.endDate)
            if (currentEndDate > now) {
              baseDate = currentEndDate
            }
          }
          
          const newEndDate = new Date(baseDate)
          newEndDate.setDate(newEndDate.getDate() + interval)
          
          return { endDate: newEndDate }
        })()),
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
    const errorMessage = error?.message || String(error)
    const errorCode = error?.code || 'UNKNOWN_ERROR'
    const errorStatus = error?.status || error?.statusCode
    
    logger.error('Error processing Mercado Pago payment (non-MP error)', error, {
      endpoint: '/api/subscriptions/payment-method',
      method: 'POST',
      errorMessage,
      errorCode,
      errorStatus,
      errorStack: error?.stack,
    })
    
    return NextResponse.json(
      { 
        error: 'Error interno al procesar el pago', 
        details: process.env.NODE_ENV === 'development' ? errorMessage : undefined,
        code: errorCode,
      },
      { status: 500 }
    )
  }
}

