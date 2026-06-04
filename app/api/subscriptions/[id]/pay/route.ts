import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-middleware'
import { prisma } from '@/lib/db'
import { createPaymentSession, generateReference } from '@/lib/wompi'
import { logger } from '@/lib/logger'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

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
      
      if (errorMessage.includes('MaxClientsInSessionMode') || errorMessage.includes('max clients reached')) {
        if (attempt < maxRetries - 1) {
          const backoffDelay = Math.min(delay * Math.pow(2, attempt), 10000)
          logger.warn(`[Subscription Pay] Límite de conexiones alcanzado, reintentando en ${backoffDelay}ms (intento ${attempt + 1}/${maxRetries})`)
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
 * POST /api/subscriptions/[id]/pay
 * Crea una sesión de pago en Wompi para una suscripción
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

    if (subscription.tenantId !== user.tenantId) {
      return NextResponse.json(
        { error: 'No tienes permiso para pagar esta suscripción' },
        { status: 403 }
      )
    }

    const wompiPublicKey = process.env.NEXT_PUBLIC_WOMPI_PUBLIC_KEY || process.env.WOMPI_PUBLIC_KEY
    
    if (!wompiPublicKey) {
      return NextResponse.json(
        { error: 'Wompi no está configurado. Contacta al administrador.' },
        { status: 500 }
      )
    }

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

    const amount = subscription.plan.price
    const currency = subscription.plan.currency || 'COP'
    const baseUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://clivaro.vercel.app'
    const reference = generateReference(user.tenantId)

    const paymentSession = createPaymentSession(
      reference,
      Math.round(amount * 100),
      `${baseUrl}/settings?tab=subscription&payment=wompi&ref=${reference}`,
      currency
    )

    await executeWithRetry(() => prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        wompiReference: reference,
        wompiStatus: 'PENDING',
        status: 'pending_payment',
      },
    }))

    logger.info('Wompi subscription payment session created', {
      subscriptionId: subscription.id,
      reference,
      amount,
      planName: subscription.plan.name,
    })

    return NextResponse.json({
      success: true,
      subscriptionId: subscription.id,
      ...paymentSession,
    })
  } catch (error: any) {
    logger.error('Error creating Wompi subscription payment', error, {
      endpoint: '/api/subscriptions/[id]/pay',
      method: 'POST',
    })
    return NextResponse.json(
      { error: 'Error al crear sesión de pago', details: error?.message || String(error) },
      { status: 500 }
    )
  }
}
