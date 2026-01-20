import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-middleware'
import { prisma } from '@/lib/db'
import { logger } from '@/lib/logger'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const changePlanSchema = z.object({
  newPlanId: z.string().min(1, 'Plan ID es requerido'),
})

// Función helper para ejecutar consultas con retry
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
          logger.warn(`[Change Plan] Límite de conexiones alcanzado, reintentando en ${backoffDelay}ms (intento ${attempt + 1}/${maxRetries})`)
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
 * PUT /api/subscriptions/[id]/change-plan
 * Cambia el plan de una suscripción (upgrade o downgrade)
 */
export async function PUT(
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
        { error: 'Super admin no puede cambiar planes de tenant' },
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
    const validatedData = changePlanSchema.parse(body)

    // Obtener la suscripción actual
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
        { error: 'No tienes permiso para cambiar esta suscripción' },
        { status: 403 }
      )
    }

    // Verificar que el nuevo plan existe y está activo
    const newPlan = await executeWithRetry(() => prisma.plan.findUnique({
      where: { id: validatedData.newPlanId },
    }))

    if (!newPlan) {
      return NextResponse.json(
        { error: 'Plan no encontrado' },
        { status: 404 }
      )
    }

    if (!newPlan.active) {
      return NextResponse.json(
        { error: 'El plan seleccionado no está disponible' },
        { status: 400 }
      )
    }

    // Verificar que no sea el mismo plan
    if (subscription.planId === validatedData.newPlanId) {
      return NextResponse.json(
        { error: 'Ya estás suscrito a este plan' },
        { status: 400 }
      )
    }

    // Determinar si es upgrade o downgrade
    const isUpgrade = newPlan.price > subscription.plan.price
    const isDowngrade = newPlan.price < subscription.plan.price

    // Calcular la diferencia de precio
    const priceDifference = newPlan.price - subscription.plan.price

    // Si es upgrade, el cambio es inmediato y se cobra la diferencia prorrateada
    // Si es downgrade, el cambio se aplica en el próximo ciclo de facturación
    const now = new Date()
    const currentEndDate = subscription.endDate ? new Date(subscription.endDate) : null
    
    // Calcular días restantes en el período actual
    let daysRemaining = 0
    if (currentEndDate && currentEndDate > now) {
      daysRemaining = Math.ceil((currentEndDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    }

    // Calcular el prorrateo (días restantes / días totales del período)
    const intervalDays = subscription.plan.interval === 'monthly' ? 30 : 365
    const proratedAmount = daysRemaining > 0 
      ? (priceDifference * daysRemaining) / intervalDays
      : 0

    // Actualizar la suscripción con el nuevo plan
    const updatedSubscription = await executeWithRetry(() => prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        planId: validatedData.newPlanId,
        // Si es upgrade, mantener el mismo endDate (el cambio es inmediato)
        // Si es downgrade, también mantener el endDate (el cambio se aplica en el próximo ciclo)
        // En ambos casos, el próximo pago será con el nuevo plan
        status: subscription.status === 'active' ? 'active' : subscription.status,
      },
      include: {
        plan: true,
      },
    }))

    logger.info('Subscription plan changed', {
      subscriptionId: subscription.id,
      oldPlanId: subscription.planId,
      oldPlanName: subscription.plan.name,
      newPlanId: validatedData.newPlanId,
      newPlanName: newPlan.name,
      isUpgrade,
      isDowngrade,
      priceDifference,
      proratedAmount,
      daysRemaining,
    })

    return NextResponse.json({
      success: true,
      message: isUpgrade 
        ? 'Plan actualizado exitosamente. El cambio es inmediato.'
        : 'Plan actualizado exitosamente. El cambio se aplicará en tu próximo ciclo de facturación.',
      subscription: updatedSubscription,
      isUpgrade,
      isDowngrade,
      priceDifference,
      proratedAmount,
      daysRemaining,
      // Si es upgrade y hay diferencia prorrateada, indicar que se debe procesar un pago
      requiresPayment: isUpgrade && proratedAmount > 0,
    })
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Datos inválidos', details: error.errors },
        { status: 400 }
      )
    }

    logger.error('Error changing subscription plan', error, {
      subscriptionId: params instanceof Promise ? 'pending' : params.id,
    })

    return NextResponse.json(
      { 
        error: error.message || 'Error al cambiar el plan',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      },
      { status: 500 }
    )
  }
}

