import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-middleware'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

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

    // Obtener la suscripción activa del tenant
    // Usar select en lugar de include para evitar problemas con campos nuevos no migrados
    const subscription = await prisma.subscription.findFirst({
      where: {
        tenantId: tenantId,
        status: 'active',
      },
      select: {
        id: true,
        planId: true,
        status: true,
        startDate: true,
        endDate: true,
        trialEndDate: true,
        createdAt: true,
        mercadoPagoPaymentMethod: true,
        mercadoPagoStatus: true,
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
    })

    if (!subscription) {
      return NextResponse.json({
        plan: null,
        subscription: null,
        features: null,
      })
    }

    // Verificar si la suscripción está vigente
    const now = new Date()
    const isExpired = subscription.endDate && new Date(subscription.endDate) < now

    if (isExpired) {
      return NextResponse.json({
        plan: null,
        subscription: null,
        features: null,
        expired: true,
      })
    }

    // Obtener la suscripción cancelada más reciente para comparar planes
    const previousSubscription = await prisma.subscription.findFirst({
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
    })

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

    return NextResponse.json({
      plan: subscription.plan,
      subscription: {
        id: subscription.id,
        status: subscription.status,
        startDate: subscription.startDate,
        endDate: subscription.endDate,
        trialEndDate: subscription.trialEndDate,
        createdAt: subscription.createdAt,
        mercadoPagoPaymentMethod: subscription.mercadoPagoPaymentMethod,
        mercadoPagoStatus: subscription.mercadoPagoStatus,
        nextPaymentDate: nextPaymentDate?.toISOString() || null,
      },
      features: subscription.plan.features ? JSON.parse(subscription.plan.features) : [],
      previousPlan: previousSubscription && planChanged ? {
        id: previousSubscription.plan.id,
        name: previousSubscription.plan.name,
      } : null,
      isRecentChange: planChanged,
    })
  } catch (error: any) {
    console.error('Error fetching tenant plan:', error)
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

