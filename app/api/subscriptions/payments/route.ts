import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-middleware'
import { prisma } from '@/lib/db'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

// Función helper para ejecutar consultas con retry y manejo de errores de conexión
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
      
      // Si es error de límite de conexiones, esperar y reintentar
      if (errorMessage.includes('MaxClientsInSessionMode') || errorMessage.includes('max clients reached')) {
        if (attempt < maxRetries - 1) {
          const backoffDelay = Math.min(delay * Math.pow(2, attempt), 15000) // Backoff exponencial, max 15s
          logger.warn(`[Subscription Payments] Límite de conexiones alcanzado, reintentando en ${backoffDelay}ms (intento ${attempt + 1}/${maxRetries})`)
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
      return NextResponse.json({ payments: [] })
    }

    const tenantId = user.tenantId

    if (!tenantId) {
      return NextResponse.json(
        { error: 'No tenant associated with user' },
        { status: 400 }
      )
    }

    // Obtener todas las suscripciones del tenant que tienen pagos aprobados (con retry logic)
    const subscriptions = await executeWithRetry(() => prisma.subscription.findMany({
      where: {
        tenantId: tenantId,
        mercadoPagoStatus: 'approved',
        mercadoPagoPaymentId: { not: null },
      },
      select: {
        id: true,
        createdAt: true,
        updatedAt: true,
        plan: {
          select: {
            id: true,
            name: true,
            price: true,
            currency: true,
            interval: true,
          },
        },
        mercadoPagoPaymentId: true,
        mercadoPagoStatus: true,
        mercadoPagoPaymentMethod: true,
        mercadoPagoTransactionId: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 50, // Limitar a los últimos 50 pagos
    }))

    // Transformar las suscripciones en pagos para el historial
    const payments = subscriptions.map((sub) => ({
      id: sub.id,
      date: sub.createdAt,
      amount: sub.plan.price,
      currency: sub.plan.currency,
      status: sub.mercadoPagoStatus === 'approved' ? 'Paid' : 'Pending',
      paymentMethod: sub.mercadoPagoPaymentMethod,
      transactionId: sub.mercadoPagoTransactionId,
      mercadoPagoPaymentId: sub.mercadoPagoPaymentId,
      planName: sub.plan.name,
      interval: sub.plan.interval,
    }))

    return NextResponse.json({ payments })
  } catch (error: any) {
    console.error('Error fetching subscription payments:', error)
    return NextResponse.json(
      { 
        error: error.message || 'Error al obtener el historial de pagos',
        details: error?.message || String(error),
        code: error?.code || 'UNKNOWN_ERROR',
      },
      { status: 500 }
    )
  }
}

