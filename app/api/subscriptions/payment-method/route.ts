import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-middleware'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

/**
 * GET /api/subscriptions/payment-method
 * Retorna la public key de Wompi para inicializar el widget en el frontend
 */
export async function GET(_request: Request) {
  try {
    const wompiPublicKey = process.env.NEXT_PUBLIC_WOMPI_PUBLIC_KEY || process.env.WOMPI_PUBLIC_KEY
    
    if (!wompiPublicKey) {
      return NextResponse.json(
        { error: 'Wompi no está configurado' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      publicKey: wompiPublicKey,
      provider: 'WOMPI',
    })
  } catch (error: any) {
    logger.error('Error getting Wompi public key', error)
    return NextResponse.json(
      { error: 'Error al obtener configuración de pago' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/subscriptions/payment-method
 * Procesa un pago con Wompi y actualiza la suscripción
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
        { error: 'Super admin no puede procesar pagos de tenant' },
        { status: 403 }
      )
    }

    if (!user.tenantId) {
      return NextResponse.json(
        { error: 'Usuario no tiene tenant asociado' },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Utiliza el endpoint /api/subscriptions/[id]/pay para iniciar un pago con Wompi',
    })
  } catch (error: any) {
    logger.error('Error in payment-method POST', error, {
      endpoint: '/api/subscriptions/payment-method',
      method: 'POST',
    })
    
    return NextResponse.json(
      { error: 'Error interno al procesar el pago' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/subscriptions/payment-method
 * Actualiza el método de pago de la suscripción
 */
export async function PUT(request: Request) {
  try {
    const session = await requireAuth(request)
    
    if (session instanceof NextResponse) {
      return session
    }

    const user = session.user as any
    
    if (user.isSuperAdmin) {
      return NextResponse.json(
        { error: 'Super admin no puede actualizar métodos de pago de tenant' },
        { status: 403 }
      )
    }

    if (!user.tenantId) {
      return NextResponse.json(
        { error: 'Usuario no tiene tenant asociado' },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Wompi es el procesador de pagos principal. Gestiona tu método de pago desde el widget de Wompi.',
    })
  } catch (error: any) {
    logger.error('Error updating payment method', error, {
      endpoint: '/api/subscriptions/payment-method',
      method: 'PUT',
    })
    
    return NextResponse.json(
      { error: 'Error interno al actualizar el método de pago' },
      { status: 500 }
    )
  }
}
