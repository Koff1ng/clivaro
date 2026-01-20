import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-middleware'
import { prisma } from '@/lib/db'
import { logger } from '@/lib/logger'
import { MercadoPagoConfig, PreApproval } from 'mercadopago'

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
 * POST /api/subscriptions/cancel
 * Cancela una suscripción recurrente
 * 
 * Query params:
 * - cancelAtPeriodEnd: boolean (default: false) - Si true, cancela al final del período actual
 */
export async function POST(
  request: Request,
  { params }: { params: { id?: string } | Promise<{ id?: string }> }
) {
  try {
    const session = await requireAuth(request)
    
    if (session instanceof NextResponse) {
      return session
    }

    const user = session.user as any
    
    if (user.isSuperAdmin) {
      return NextResponse.json(
        { error: 'Super admin no puede cancelar suscripciones' },
        { status: 403 }
      )
    }

    const tenantId = user.tenantId
    if (!tenantId) {
      return NextResponse.json(
        { error: 'Usuario no tiene tenant asociado' },
        { status: 400 }
      )
    }

    const body = await request.json()
    const cancelAtPeriodEnd = body.cancelAtPeriodEnd === true

    // Obtener la suscripción activa del tenant
    const subscription = await executeWithRetry(() => prisma.subscription.findFirst({
      where: {
        tenantId: tenantId,
        status: {
          in: ['active', 'pending_payment', 'trial'],
        },
      },
      include: {
        plan: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    }))

    if (!subscription) {
      return NextResponse.json(
        { error: 'No se encontró una suscripción activa' },
        { status: 404 }
      )
    }

    // Verificar credenciales de Mercado Pago
    const mercadoPagoAccessToken = process.env.MERCADOPAGO_ACCESS_TOKEN?.trim()
    if (!mercadoPagoAccessToken) {
      return NextResponse.json(
        { error: 'Mercado Pago no está configurado' },
        { status: 500 }
      )
    }

    // Si tiene Preapproval ID, cancelarlo en Mercado Pago
    if (subscription.mercadoPagoPreferenceId) {
      try {
        const client = new MercadoPagoConfig({ accessToken: mercadoPagoAccessToken })
        const preApproval = new PreApproval(client)

        // Cancelar el Preapproval en Mercado Pago
        await preApproval.update({
          id: subscription.mercadoPagoPreferenceId,
          body: {
            status: 'cancelled',
          },
        })

        logger.info('Mercado Pago Preapproval cancelled', {
          subscriptionId: subscription.id,
          mpPreapprovalId: subscription.mercadoPagoPreferenceId,
        })
      } catch (error: any) {
        logger.error('Error cancelling Mercado Pago Preapproval', error, {
          subscriptionId: subscription.id,
          mpPreapprovalId: subscription.mercadoPagoPreferenceId,
        })
        // Continuar con la cancelación local aunque falle en MP
      }
    }

    // Actualizar la suscripción en la base de datos
    const updateData: any = {
      status: cancelAtPeriodEnd ? 'active' : 'cancelled', // Si cancelAtPeriodEnd, mantener activa hasta el fin del período
      autoRenew: false,
      mercadoPagoStatus: 'cancelled',
      updatedAt: new Date(),
    }

    // Si cancelAtPeriodEnd es true, agregar campo para tracking (si existe en schema)
    // Nota: Si tu schema tiene un campo cancelAtPeriodEnd, úsalo aquí

    const cancelledSubscription = await executeWithRetry(() => prisma.subscription.update({
      where: { id: subscription.id },
      data: updateData,
      include: {
        plan: true,
      },
    }))

    logger.info('Subscription cancelled', {
      subscriptionId: subscription.id,
      cancelAtPeriodEnd,
      endDate: subscription.endDate,
    })

    return NextResponse.json({
      success: true,
      message: cancelAtPeriodEnd 
        ? 'La suscripción se cancelará al final del período actual'
        : 'Suscripción cancelada exitosamente',
      subscription: {
        id: cancelledSubscription.id,
        status: cancelledSubscription.status,
        endDate: cancelledSubscription.endDate,
        autoRenew: cancelledSubscription.autoRenew,
      },
    })
  } catch (error: any) {
    logger.error('Error cancelling subscription', error, {
      endpoint: '/api/subscriptions/cancel',
      method: 'POST',
    })

    return NextResponse.json(
      { 
        error: 'Error al cancelar la suscripción',
        details: process.env.NODE_ENV === 'development' ? error?.message : undefined,
      },
      { status: 500 }
    )
  }
}

