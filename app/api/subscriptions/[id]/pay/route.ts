import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-middleware'
import { prisma } from '@/lib/db'
import { createPaymentPreference } from '@/lib/mercadopago'
import { logger } from '@/lib/logger'
import { z } from 'zod'

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
          logger.warn(`[Subscription Pay] Límite de conexiones alcanzado, reintentando en ${backoffDelay}ms (intento ${attempt + 1}/${maxRetries})`)
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
 * POST /api/subscriptions/[id]/pay
 * Crea una preferencia de pago en Mercado Pago para una suscripción
 */
export async function POST(
  request: Request,
  { params }: { params: { id: string } | Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await Promise.resolve(params)
    const subscriptionId = resolvedParams.id

    const session = await requireAuth(request)
    
    if (session instanceof NextResponse) {
      return session
    }

    const user = session.user as any
    
    if (user.isSuperAdmin) {
      return NextResponse.json(
        { error: 'Super admin no puede pagar suscripciones de tenant' },
        { status: 403 }
      )
    }

    if (!user.tenantId) {
      return NextResponse.json(
        { error: 'Usuario no tiene tenant asociado' },
        { status: 400 }
      )
    }

    // Obtener la suscripción
    const subscription = await executeWithRetry(() => prisma.subscription.findUnique({
      where: { id: subscriptionId },
      include: {
        plan: true,
        tenant: {
          include: {
            settings: true,
          },
        },
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
        { error: 'No tienes permiso para pagar esta suscripción' },
        { status: 403 }
      )
    }

    // Verificar que Mercado Pago está configurado (usando credenciales globales de Clivaro)
    // Limpiar espacios y saltos de línea del token
    const mercadoPagoAccessToken = process.env.MERCADOPAGO_ACCESS_TOKEN?.trim()
    const mercadoPagoPublicKey = process.env.MERCADOPAGO_PUBLIC_KEY?.trim()
    
    if (!mercadoPagoAccessToken) {
      return NextResponse.json(
        { error: 'Mercado Pago no está configurado. Contacta al administrador.' },
        { status: 500 }
      )
    }

    // Verificar que la suscripción necesita pago
    if (subscription.status === 'active') {
      const now = new Date()
      const endDate = subscription.endDate ? new Date(subscription.endDate) : null
      
      if (endDate && endDate > now) {
        return NextResponse.json(
          { error: 'La suscripción ya está activa y pagada' },
          { status: 400 }
        )
      }
    }

    // Calcular el monto a pagar
    const amount = subscription.plan.price

    // Crear la preferencia de pago
    const baseUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://clivaro.vercel.app'
    const tenantSlug = subscription.tenant.slug

    // Construir la URL del webhook explícitamente
    const webhookUrl = `${baseUrl}/api/payments/mercadopago/webhook`

    const preference = await createPaymentPreference(
      {
        accessToken: mercadoPagoAccessToken,
        publicKey: mercadoPagoPublicKey || undefined,
      },
      {
        title: `Suscripción ${subscription.plan.name}`,
        description: `Pago de suscripción ${subscription.plan.name} - ${subscription.plan.interval === 'monthly' ? 'Mensual' : 'Anual'}`,
        amount: amount,
        currency: subscription.plan.currency || 'COP',
        subscriptionId: subscription.id,
        customerEmail: subscription.tenant.email || undefined,
        customerName: subscription.tenant.name,
        backUrls: {
          success: `${baseUrl}/settings?tab=subscription&payment=success`,
          failure: `${baseUrl}/settings?tab=subscription&payment=failure`,
          pending: `${baseUrl}/settings?tab=subscription&payment=pending`,
        },
        autoReturn: 'approved',
        externalReference: subscription.id,
        notificationUrl: webhookUrl, // Proporcionar explícitamente la URL del webhook
      }
    )

    // Actualizar la suscripción con la información del pago
    const updatedSubscription = await executeWithRetry(() => prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        mercadoPagoPreferenceId: preference.preferenceId,
        mercadoPagoStatus: 'pending',
        status: 'pending_payment',
      },
    }))

    logger.info('Mercado Pago subscription payment preference created', {
      subscriptionId: subscription.id,
      preferenceId: preference.preferenceId,
      amount: amount,
      planName: subscription.plan.name,
    })

    return NextResponse.json({
      success: true,
      subscriptionId: subscription.id,
      preferenceId: preference.preferenceId,
      initPoint: preference.initPoint,
      sandboxInitPoint: preference.sandboxInitPoint,
      isTestMode: preference.isTestMode || false,
      publicKey: mercadoPagoPublicKey || undefined,
    })
  } catch (error: any) {
    logger.error('Error creating Mercado Pago subscription payment', error, {
      endpoint: '/api/subscriptions/[id]/pay',
      method: 'POST',
    })
    return NextResponse.json(
      { error: 'Error al crear preferencia de pago', details: error?.message || String(error) },
      { status: 500 }
    )
  }
}

