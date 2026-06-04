import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-middleware'
import { prisma } from '@/lib/db'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'
import { safeErrorMessage } from '@/lib/safe-error'

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
          logger.warn(`[Subscription Payments] Límite de conexiones alcanzado, reintentando en ${backoffDelay}ms (intento ${attempt + 1}/${maxRetries})`)
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
 * Obtiene el historial de pagos de suscripciones del tenant actual
 */
export async function GET(request: Request) {
  try {
    const session = await requireAuth(request)
    
    if (session instanceof NextResponse) {
      return session
    }

    const user = session.user as any
    if (user.isSuperAdmin) {
      return NextResponse.json({ payments: [], total: 0, page: 1, limit: 4, totalPages: 0 })
    }

    const tenantId = user.tenantId

    if (!tenantId) {
      return NextResponse.json(
        { error: 'No tenant associated with user' },
        { status: 400 }
      )
    }

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1', 10)
    const limit = parseInt(searchParams.get('limit') || '4', 10)
    const skip = (page - 1) * limit

    const subscription = await executeWithRetry(() => prisma.subscription.findFirst({
      where: {
        tenantId: tenantId,
      },
      select: {
        id: true,
        plan: {
          select: {
            id: true,
            name: true,
            price: true,
            currency: true,
            interval: true,
          },
        },
        wompiReference: true,
        wompiStatus: true,
        wompiPaymentMethod: true,
        wompiTransactionId: true,
        wompiResponse: true,
        updatedAt: true,
      },
    }))

    const subscriptionPayments: any[] = []
    if (subscription) {
      // Wompi payment (current)
      if (subscription.wompiReference) {
        subscriptionPayments.push({
          id: `wompi-${subscription.id}`,
          date: subscription.updatedAt,
          amount: subscription.plan.price,
          currency: subscription.plan.currency,
          status: subscription.wompiStatus === 'APPROVED' ? 'Paid' :
                  subscription.wompiStatus === 'DECLINED' || subscription.wompiStatus === 'VOIDED' ? 'Failed' :
                  subscription.wompiStatus === 'ERROR' ? 'Error' : 'Pending',
          wompiStatus: subscription.wompiStatus,
          paymentMethod: subscription.wompiPaymentMethod,
          transactionId: subscription.wompiTransactionId,
          reference: subscription.wompiReference,
          planName: subscription.plan.name,
          interval: subscription.plan.interval,
          provider: 'WOMPI',
        })
      }

      // Legacy MercadoPago payments (historical only)
      const legacySub = await executeWithRetry(() => prisma.subscription.findFirst({
        where: {
          tenantId: tenantId,
          mercadoPagoPaymentId: { not: null },
        },
        select: {
          id: true,
          updatedAt: true,
          mercadoPagoPaymentId: true,
          mercadoPagoStatus: true,
          mercadoPagoStatusDetail: true,
          mercadoPagoPaymentMethod: true,
          mercadoPagoTransactionId: true,
        },
      }))

      if (legacySub?.mercadoPagoPaymentId) {
        const isDuplicate = subscriptionPayments.some(
          p => p.transactionId === legacySub.mercadoPagoTransactionId
        )
        if (!isDuplicate) {
          subscriptionPayments.push({
            id: `mp-legacy-${legacySub.id}`,
            date: legacySub.updatedAt,
            amount: subscription.plan.price,
            currency: subscription.plan.currency,
            status: legacySub.mercadoPagoStatus === 'approved' ? 'Paid' :
                    legacySub.mercadoPagoStatus === 'rejected' || legacySub.mercadoPagoStatus === 'cancelled' ? 'Failed' :
                    legacySub.mercadoPagoStatus === 'refunded' ? 'Refunded' : 'Pending',
            paymentMethod: legacySub.mercadoPagoPaymentMethod,
            transactionId: legacySub.mercadoPagoTransactionId,
            planName: subscription.plan.name,
            interval: subscription.plan.interval,
            provider: 'MERCADOPAGO (legacy)',
          })
        }
      }
    }

    subscriptionPayments.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    const total = subscriptionPayments.length
    const paginatedPayments = subscriptionPayments.slice(skip, skip + limit)
    const totalPages = Math.ceil(total / limit)

    return NextResponse.json({ 
      payments: paginatedPayments,
      total,
      page,
      limit,
      totalPages,
    })
  } catch (error: any) {
    let tenantId: string | undefined
    try {
      const session = await requireAuth(request)
      if (!(session instanceof NextResponse)) {
        tenantId = (session.user as any)?.tenantId
      }
    } catch {
      // Ignorar errores de autenticación en el catch
    }
    
    logger.error('Error fetching subscription payments', error, {
      endpoint: '/api/subscriptions/payments',
      method: 'GET',
      tenantId,
    })
    return NextResponse.json(
      { 
        error: safeErrorMessage(error, 'Error al obtener el historial de pagos'),
        details: process.env.NODE_ENV === 'development' ? error?.message : undefined,
        code: error?.code || 'UNKNOWN_ERROR',
      },
      { status: 500 }
    )
  }
}
