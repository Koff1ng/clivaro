import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-middleware'
import { prisma } from '@/lib/db'
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
 * POST /api/subscriptions/[id]/cancel
 * Cancela una suscripción activa
 */
export async function POST(
  request: Request,
  { params }: { params: { id: string } | Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params
    const subscriptionId = resolvedParams.id

    const session = await requireAuth(request)
    
    if (session instanceof NextResponse) {
      return session
    }

    const user = session.user as any
    
    if (user.isSuperAdmin) {
      return NextResponse.json(
        { error: 'Super admin no puede cancelar suscripciones de tenant' },
        { status: 403 }
      )
    }

    if (!user.tenantId) {
      return NextResponse.json(
        { error: 'Usuario no tiene tenant asociado' },
        { status: 400 }
      )
    }

    // Obtener la suscripción con retry logic
    const subscription = await executeWithRetry(() => prisma.subscription.findUnique({
      where: { id: subscriptionId },
      include: {
        plan: true,
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
        { error: 'No tienes permiso para cancelar esta suscripción' },
        { status: 403 }
      )
    }

    // Verificar que la suscripción está activa
    if (subscription.status !== 'active') {
      return NextResponse.json(
        { error: 'Solo se pueden cancelar suscripciones activas' },
        { status: 400 }
      )
    }

    // Cancelar la suscripción con retry logic
    const cancelledSubscription = await executeWithRetry(() => prisma.subscription.update({
      where: { id: subscriptionId },
      data: {
        status: 'cancelled',
        autoRenew: false,
      },
      include: {
        plan: true,
      },
    }))

    return NextResponse.json({
      message: 'Suscripción cancelada exitosamente',
      subscription: cancelledSubscription,
    })
  } catch (error: any) {
    logger.error('Error cancelling subscription', error, {
      endpoint: '/api/subscriptions/[id]/cancel',
      method: 'POST',
    })
    return NextResponse.json(
      { 
        error: error.message || 'Error al cancelar la suscripción',
        details: error?.message || String(error),
        code: error?.code || 'UNKNOWN_ERROR',
      },
      { status: 500 }
    )
  }
}

