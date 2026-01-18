import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-middleware'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

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

    // Obtener la suscripción
    const subscription = await prisma.subscription.findUnique({
      where: { id: subscriptionId },
      include: {
        plan: true,
      },
    })

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

    // Cancelar la suscripción
    const cancelledSubscription = await prisma.subscription.update({
      where: { id: subscriptionId },
      data: {
        status: 'cancelled',
        autoRenew: false,
      },
      include: {
        plan: true,
      },
    })

    return NextResponse.json({
      message: 'Suscripción cancelada exitosamente',
      subscription: cancelledSubscription,
    })
  } catch (error: any) {
    console.error('Error cancelling subscription:', error)
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

