import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { PlanName, hasFeature } from './plan-features'

/**
 * Obtiene el plan activo de un tenant
 */
export async function getTenantActivePlan(tenantId: string): Promise<PlanName | null> {
  try {
    const subscription = await prisma.subscription.findFirst({
      where: {
        tenantId: tenantId,
        status: 'active',
      },
      include: {
        plan: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    if (!subscription) return null

    // Verificar si la suscripción está vigente
    const now = new Date()
    if (subscription.endDate && new Date(subscription.endDate) < now) {
      return null
    }

    return subscription.plan.name as PlanName
  } catch (error) {
    console.error('Error fetching tenant plan:', error)
    return null
  }
}

/**
 * Verifica si el tenant tiene acceso a una feature específica
 */
export async function requirePlanFeature(
  tenantId: string | null,
  feature: string,
  isSuperAdmin: boolean = false
): Promise<NextResponse | null> {
  // Super admin siempre tiene acceso
  if (isSuperAdmin) {
    return null
  }

  if (!tenantId) {
    return NextResponse.json(
      { error: 'No tenant associated with user' },
      { status: 403 }
    )
  }

  const planName = await getTenantActivePlan(tenantId)

  if (!planName) {
    return NextResponse.json(
      { error: 'No active subscription found. Please contact support.' },
      { status: 403 }
    )
  }

  const hasAccess = hasFeature(planName, feature as any)

  if (!hasAccess) {
    return NextResponse.json(
      { 
        error: 'This feature is not available in your current plan. Please upgrade to access this functionality.',
        requiredPlan: getRequiredPlanForFeature(feature),
      },
      { status: 403 }
    )
  }

  return null
}

/**
 * Obtiene el plan mínimo requerido para una feature
 */
function getRequiredPlanForFeature(feature: string): string {
  const featureMap: Record<string, string> = {
    leads: 'Business',
    marketing: 'Business',
    quotations: 'Business',
    multiWarehouse: 'Business',
    advancedReports: 'Business',
    apiAccess: 'Enterprise',
    customReports: 'Enterprise',
  }

  return featureMap[feature] || 'Business'
}

