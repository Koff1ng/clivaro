import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-middleware'
import { prisma } from '@/lib/db'
import { logger } from '@/lib/logger'
import { MercadoPagoConfig, PreApproval } from 'mercadopago'
import { z } from 'zod'

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
          logger.warn(`[Payment Method] Retry ${attempt + 1}/${maxRetries} in ${backoffDelay}ms`)
          await new Promise(resolve => setTimeout(resolve, backoffDelay))
          continue
        }
      }
      throw error
    }
  }
  throw lastError
}

const updatePaymentMethodSchema = z.object({
  subscriptionId: z.string().optional(), // Si no se proporciona, se usa la suscripción activa del tenant
  cardTokenId: z.string(), // Nuevo token de tarjeta
})

/**
 * GET /api/subscriptions/payment-method
 * Obtiene la public key de Mercado Pago para inicializar el SDK en el frontend
 */
export async function GET(request: Request) {
  try {
    const session = await requireAuth(request)
    
    if (session instanceof NextResponse) {
      return session
    }

    const mercadoPagoPublicKey = process.env.MERCADOPAGO_PUBLIC_KEY?.trim()
    
    if (!mercadoPagoPublicKey) {
      return NextResponse.json(
        { error: 'Mercado Pago no está configurado' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      publicKey: mercadoPagoPublicKey,
    })
  } catch (error: any) {
    logger.error('Error getting Mercado Pago public key', error)
    return NextResponse.json(
      { error: 'Error al obtener configuración de pago' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/subscriptions/payment-method
 * Actualiza el método de pago (tarjeta) de una suscripción existente
 */
export async function POST(request: Request) {
  try {
    const session = await requireAuth(request)
    
    if (session instanceof NextResponse) {
      return session
    }

    const user = session.user as any
    
    if (user.isSuperAdmin) {
      return NextResponse.json(
        { error: 'Super admin no puede actualizar métodos de pago' },
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
    const validatedData = updatePaymentMethodSchema.parse(body)

    // Obtener la suscripción
    let subscription
    if (validatedData.subscriptionId) {
      subscription = await executeWithRetry(() => prisma.subscription.findUnique({
        where: { id: validatedData.subscriptionId },
        include: { plan: true },
      }))
    } else {
      // Obtener la suscripción activa del tenant
      subscription = await executeWithRetry(() => prisma.subscription.findFirst({
        where: {
          tenantId: tenantId,
          status: {
            in: ['active', 'pending_payment', 'trial'],
          },
        },
        include: { plan: true },
        orderBy: { createdAt: 'desc' },
      }))
    }

    if (!subscription) {
      return NextResponse.json(
        { error: 'Suscripción no encontrada' },
        { status: 404 }
      )
    }

    // Verificar que la suscripción pertenece al tenant del usuario
    if (subscription.tenantId !== tenantId) {
      return NextResponse.json(
        { error: 'No tienes permiso para actualizar esta suscripción' },
        { status: 403 }
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

    // Si no tiene Preapproval ID, no se puede actualizar el método de pago
    if (!subscription.mercadoPagoPreferenceId) {
      return NextResponse.json(
        { error: 'La suscripción no tiene un método de pago configurado en Mercado Pago' },
        { status: 400 }
      )
    }

    // Actualizar el Preapproval en Mercado Pago con el nuevo token de tarjeta
    try {
      const client = new MercadoPagoConfig({ accessToken: mercadoPagoAccessToken })
      const preApproval = new PreApproval(client)

      await preApproval.update({
        id: subscription.mercadoPagoPreferenceId,
        body: {
          card_token_id: validatedData.cardTokenId,
        },
      })

      logger.info('Payment method updated in Mercado Pago', {
        subscriptionId: subscription.id,
        mpPreapprovalId: subscription.mercadoPagoPreferenceId,
      })
    } catch (error: any) {
      logger.error('Error updating payment method in Mercado Pago', error, {
        subscriptionId: subscription.id,
        mpPreapprovalId: subscription.mercadoPagoPreferenceId,
      })

      return NextResponse.json(
        { 
          error: 'Error al actualizar el método de pago en Mercado Pago',
          details: process.env.NODE_ENV === 'development' ? error?.message : undefined,
        },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Método de pago actualizado exitosamente',
    })
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Datos inválidos', details: error.errors },
        { status: 400 }
      )
    }

    logger.error('Error updating payment method', error, {
      endpoint: '/api/subscriptions/payment-method',
      method: 'POST',
    })

    return NextResponse.json(
      { 
        error: 'Error al actualizar el método de pago',
        details: process.env.NODE_ENV === 'development' ? error?.message : undefined,
      },
      { status: 500 }
    )
  }
}
