import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-middleware'
import { prisma } from '@/lib/db'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

// Función helper para ejecutar consultas con retry y manejo de errores de conexión
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

      // Si es error de límite de conexiones, esperar y reintentar
      if (errorMessage.includes('MaxClientsInSessionMode') || errorMessage.includes('max clients reached')) {
        if (attempt < maxRetries - 1) {
          const backoffDelay = Math.min(delay * Math.pow(2, attempt), 15000) // Backoff exponencial, max 15s
          logger.warn(`[Tenant Plan] Límite de conexiones alcanzado, reintentando en ${backoffDelay}ms (intento ${attempt + 1}/${maxRetries})`)
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
 * Obtiene el plan activo del tenant actual
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

    // Obtener la suscripción activa o pendiente del tenant con retry logic
    // Incluir suscripciones activas y pendientes para que el usuario pueda ver el estado y reintentar pagos
    // Usar select en lugar de include para evitar problemas con campos nuevos no migrados
    const subscription = await executeWithRetry(() => prisma.subscription.findFirst({
      where: {
        tenantId: tenantId,
        status: {
          in: ['active', 'pending_payment', 'pending', 'trial'],
        },
      },
      select: {
        id: true,
        planId: true,
        status: true,
        startDate: true,
        endDate: true,
        trialEndDate: true,
        createdAt: true,
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

    if (!subscription) {
      return NextResponse.json({
        plan: null,
        subscription: null,
        features: null,
      })
    }

    // Verificar si la suscripción está vigente
    // No marcar como expirada si está pendiente de pago, para que el usuario pueda reintentar
    const now = new Date()
    const isPendingPayment = subscription.status === 'pending_payment' || subscription.status === 'pending'
    const isExpired = !isPendingPayment && subscription.endDate && new Date(subscription.endDate) < now

    // Si está expirada y no está cancelada, actualizar el estado a 'expired'
    if (isExpired && subscription.status !== 'cancelled' && subscription.status !== 'expired') {
      // Actualizar el estado en segundo plano (no bloquear la respuesta)
      prisma.subscription.update({
        where: { id: subscription.id },
        data: { status: 'expired' },
      }).catch((error) => {
        logger.error('Error updating subscription status to expired', error, {
          subscriptionId: subscription.id,
        })
      })

      return NextResponse.json({
        plan: null,
        subscription: null,
        features: null,
        expired: true,
      })
    }

    if (isExpired) {
      return NextResponse.json({
        plan: null,
        subscription: null,
        features: null,
        expired: true,
      })
    }

    // Obtener la suscripción cancelada más reciente para comparar planes (con retry)
    const previousSubscription = await executeWithRetry(() => prisma.subscription.findFirst({
      where: {
        tenantId: tenantId,
        status: 'cancelled',
      },
      select: {
        id: true,
        planId: true,
        plan: {
          select: {
            id: true,
            name: true,
          },
        },
        updatedAt: true,
      },
      orderBy: {
        updatedAt: 'desc',
      },
    }))

    // Verificar si el cambio de plan fue reciente (últimos 7 días)
    const subscriptionAge = now.getTime() - new Date(subscription.createdAt).getTime()
    const daysSinceChange = subscriptionAge / (1000 * 60 * 60 * 24)
    const isRecentChange = daysSinceChange <= 7

    // Determinar si hubo un cambio de plan
    const planChanged = previousSubscription &&
      previousSubscription.planId !== subscription.planId &&
      isRecentChange

    // Calcular la fecha del próximo pago
    const getNextPaymentDate = () => {
      if (!subscription.endDate) return null

      const endDate = new Date(subscription.endDate)
      const now = new Date()

      // Si la suscripción ya expiró, el próximo pago es ahora
      if (endDate <= now) {
        return now
      }

      // Si está activa, el próximo pago es cuando expire
      return endDate
    }

    const nextPaymentDate = getNextPaymentDate()

    // Get billing info from Wompi columns (now typed in Prisma schema)
    let billing: any = null
    try {
      const billingData = await prisma.subscription.findUnique({
        where: { id: subscription.id },
        select: {
          wompiTransactionId: true,
          wompiStatus: true,
          wompiPaymentMethod: true,
          wompiReference: true,
        },
      })
      if (billingData?.wompiTransactionId) {
        billing = {
          transactionId: billingData.wompiTransactionId,
          status: billingData.wompiStatus,
          paymentMethod: billingData.wompiPaymentMethod,
          reference: billingData.wompiReference,
          paidAt: subscription.startDate,
          amount: subscription.plan.price,
          currency: subscription.plan.currency || 'COP',
        }
      }
    } catch (e: any) {
      logger.warn('[Tenant Plan] Could not fetch billing data:', e.message)
    }

    // Fetch feature flags for this tenant from the master DB
    let featureFlags: Record<string, boolean> = {}
    try {
      const tenantFlags = await (prisma as any).tenantFeatureFlag.findMany({
        where: { tenantId },
        include: { featureFlag: { select: { key: true, isGlobal: true } } }
      })
      const globalFlags = await (prisma as any).featureFlag.findMany({
        where: { isGlobal: true },
        select: { key: true }
      })
      // Start with global flags (all enabled)
      for (const gf of globalFlags) {
        featureFlags[gf.key] = true
      }
      // Override with tenant-specific flags
      for (const tf of tenantFlags) {
        featureFlags[tf.featureFlag.key] = tf.enabled
      }
    } catch {
      // Feature flag tables may not exist yet
    }

    return NextResponse.json({
      plan: subscription.plan,
      subscription: {
        id: subscription.id,
        status: subscription.status,
        startDate: subscription.startDate,
        endDate: subscription.endDate,
        trialEndDate: subscription.trialEndDate,
        createdAt: subscription.createdAt,
        nextPaymentDate: nextPaymentDate?.toISOString() || null,
      },
      features: subscription.plan.features ? JSON.parse(subscription.plan.features) : [],
      featureFlags,
      billing,
      previousPlan: previousSubscription && planChanged ? {
        id: previousSubscription.plan.id,
        name: previousSubscription.plan.name,
      } : null,
      isRecentChange: planChanged,
    }, {
      headers: {
        'Cache-Control': 'no-store, max-age=0, must-revalidate',
        'Pragma': 'no-cache',
      }
    })
  } catch (error: any) {
    logger.error('Error fetching tenant plan:', error)
    return NextResponse.json(
      {
        error: error.message || 'Error al obtener el plan',
        details: error?.message || String(error),
        code: error?.code || 'UNKNOWN_ERROR',
      },
      { status: 500 }
    )
  }
}

