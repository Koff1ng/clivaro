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
          logger.warn(`[Payments] Retry ${attempt + 1}/${maxRetries} in ${backoffDelay}ms`)
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
 * GET /api/payments
 * Obtiene el historial de pagos del tenant
 * 
 * Query params:
 * - limit: number (default: 50)
 * - offset: number (default: 0)
 */
export async function GET(request: Request) {
  try {
    const session = await requireAuth(request)
    
    if (session instanceof NextResponse) {
      return session
    }

    const user = session.user as any
    
    if (user.isSuperAdmin) {
      return NextResponse.json({ payments: [] })
    }

    const tenantId = user.tenantId
    if (!tenantId) {
      return NextResponse.json(
        { error: 'No tenant associated with user' },
        { status: 400 }
      )
    }

    // Parsear query params
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '50', 10)
    const offset = parseInt(searchParams.get('offset') || '0', 10)

    // Obtener suscripciones del tenant que tienen pagos registrados
    const subscriptions = await executeWithRetry(() => prisma.subscription.findMany({
      where: {
        tenantId: tenantId,
        mercadoPagoPaymentId: {
          not: null,
        },
      },
      include: {
        plan: {
          select: {
            id: true,
            name: true,
            price: true,
            currency: true,
            interval: true,
          },
        },
      },
      orderBy: {
        updatedAt: 'desc',
      },
      take: limit,
      skip: offset,
    }))

    // Transformar suscripciones en pagos para el historial
    const payments = subscriptions.map((sub) => {
      // Mapear estado de Mercado Pago a estado legible
      let status = 'pending'
      if (sub.mercadoPagoStatus === 'approved') {
        status = 'paid'
      } else if (sub.mercadoPagoStatus === 'rejected' || sub.mercadoPagoStatus === 'cancelled') {
        status = 'failed'
      } else if (sub.mercadoPagoStatus === 'pending' || sub.mercadoPagoStatus === 'in_process') {
        status = 'pending'
      } else if (sub.mercadoPagoStatus === 'refunded' || sub.mercadoPagoStatus === 'charged_back') {
        status = 'refunded'
      }

      return {
        paymentId: sub.mercadoPagoPaymentId,
        amount: sub.plan.price,
        currency: sub.plan.currency,
        status: status,
        mercadoPagoStatus: sub.mercadoPagoStatus,
        mercadoPagoStatusDetail: sub.mercadoPagoStatusDetail,
        paymentMethod: sub.mercadoPagoPaymentMethod,
        transactionId: sub.mercadoPagoTransactionId,
        planName: sub.plan.name,
        planInterval: sub.plan.interval,
        createdAt: sub.updatedAt, // Usar updatedAt como fecha del pago
        subscriptionId: sub.id,
      }
    })

    // Obtener total de pagos para paginación
    const totalPayments = await executeWithRetry(() => prisma.subscription.count({
      where: {
        tenantId: tenantId,
        mercadoPagoPaymentId: {
          not: null,
        },
      },
    }))

    return NextResponse.json({
      payments,
      pagination: {
        total: totalPayments,
        limit,
        offset,
        hasMore: offset + limit < totalPayments,
      },
    })
  } catch (error: any) {
    logger.error('Error fetching payments', error, {
      endpoint: '/api/payments',
      method: 'GET',
    })

    return NextResponse.json(
      { 
        error: 'Error al obtener el historial de pagos',
        details: process.env.NODE_ENV === 'development' ? error?.message : undefined,
      },
      { status: 500 }
    )
  }
}
