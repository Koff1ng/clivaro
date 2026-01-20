import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-middleware'
import { prisma } from '@/lib/db'
import { logger } from '@/lib/logger'

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
          logger.warn(`[Tenant Plan] Retry ${attempt + 1}/${maxRetries} in ${backoffDelay}ms`)
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
 * GET /api/tenant/plan
 * Obtiene el plan actual del tenant con información completa de suscripción
 */
export async function GET(request: Request) {
  try {
    const session = await requireAuth(request)
    
    if (session instanceof NextResponse) {
      return session
    }

    const user = session.user as any
    
    if (user.isSuperAdmin) {
      return NextResponse.json({
        plan: null,
        subscription: null,
        features: null,
        isSuperAdmin: true,
      })
    }

    const tenantId = user.tenantId
    if (!tenantId) {
      return NextResponse.json(
        { error: 'No tenant associated with user' },
        { status: 400 }
      )
    }

    // Obtener la suscripción activa o pendiente más reciente
    const subscription = await executeWithRetry(() => prisma.subscription.findFirst({
      where: {
        tenantId: tenantId,
        status: {
          in: ['active', 'pending_payment', 'trial'],
        },
      },
      include: {
        plan: {
          select: {
            id: true,
            name: true,
            description: true,
            price: true,
            currency: true,
            interval: true,
            features: true,
            active: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    }))

    // Si no hay suscripción, devolver plan free
    if (!subscription) {
      return NextResponse.json({
        planId: 'free',
        status: 'inactive',
        plan: null,
        subscription: null,
        currentPeriodStart: null,
        currentPeriodEnd: null,
        nextBillingDate: null,
        cancelAtPeriodEnd: false,
        lastPaymentStatus: null,
        features: null,
      })
    }

    const now = new Date()
    const startDate = subscription.startDate ? new Date(subscription.startDate) : now
    const endDate = subscription.endDate ? new Date(subscription.endDate) : null

    // Calcular fechas del período actual
    const currentPeriodStart = startDate
    const currentPeriodEnd = endDate || null

    // Calcular próxima fecha de facturación
    // Si la suscripción está activa y tiene endDate futuro, esa es la próxima facturación
    // Si está pendiente, la próxima facturación es cuando se active
    let nextBillingDate: Date | null = null
    if (subscription.status === 'active' && endDate && endDate > now) {
      nextBillingDate = endDate
    } else if (subscription.status === 'pending_payment') {
      // Si está pendiente, la próxima facturación será cuando se procese el pago
      nextBillingDate = now
    }

    // Determinar si está cancelada al final del período
    const cancelAtPeriodEnd = subscription.status === 'active' && !subscription.autoRenew

    // Obtener el último estado de pago
    const lastPaymentStatus = subscription.mercadoPagoStatus || null

    // Parsear features del plan
    let features: any = null
    if (subscription.plan.features) {
      try {
        features = JSON.parse(subscription.plan.features)
      } catch {
        features = null
      }
    }

    return NextResponse.json({
      planId: subscription.planId,
      status: subscription.status,
      plan: {
        id: subscription.plan.id,
        name: subscription.plan.name,
        description: subscription.plan.description,
        price: subscription.plan.price,
        currency: subscription.plan.currency,
        interval: subscription.plan.interval,
        features: subscription.plan.features,
      },
      subscription: {
        id: subscription.id,
        status: subscription.status,
        startDate: subscription.startDate,
        endDate: subscription.endDate,
        autoRenew: subscription.autoRenew,
      },
      currentPeriodStart: currentPeriodStart.toISOString(),
      currentPeriodEnd: currentPeriodEnd?.toISOString() || null,
      nextBillingDate: nextBillingDate?.toISOString() || null,
      cancelAtPeriodEnd: cancelAtPeriodEnd,
      lastPaymentStatus: lastPaymentStatus,
      features: features,
    })
  } catch (error: any) {
    logger.error('Error fetching tenant plan', error, {
      endpoint: '/api/tenant/plan',
      method: 'GET',
    })

    return NextResponse.json(
      { 
        error: 'Error al obtener el plan',
        details: process.env.NODE_ENV === 'development' ? error?.message : undefined,
      },
      { status: 500 }
    )
  }
}
