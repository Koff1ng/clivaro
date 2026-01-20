import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-middleware'
import { prisma } from '@/lib/db'
import { getTenantPrisma } from '@/lib/tenant-db'
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
      return NextResponse.json({ payments: [], total: 0, page: 1, limit: 4, totalPages: 0 })
    }

    const tenantId = user.tenantId

    if (!tenantId) {
      return NextResponse.json(
        { error: 'No tenant associated with user' },
        { status: 400 }
      )
    }

    // Obtener parámetros de paginación de la URL
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1', 10)
    const limit = parseInt(searchParams.get('limit') || '4', 10)
    const skip = (page - 1) * limit

    // Obtener el tenant para acceder a su base de datos
    const tenant = await executeWithRetry(() => prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        id: true,
        databaseUrl: true,
      },
    }))

    if (!tenant) {
      return NextResponse.json(
        { error: 'Tenant no encontrado' },
        { status: 404 }
      )
    }

    // Obtener la suscripción actual para obtener el plan
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
      },
      orderBy: {
        createdAt: 'desc',
      },
    }))

    // Obtener el cliente Prisma del tenant para consultar la tabla Payment
    const tenantPrisma = getTenantPrisma(tenant.databaseUrl)

    // Buscar pagos de Mercado Pago en la tabla Payment del tenant
    // Estos son los pagos históricos de suscripciones
    const paymentRecords = await executeWithRetry(() => tenantPrisma.payment.findMany({
      where: {
        method: 'MERCADOPAGO',
        mercadoPagoPaymentId: { not: null },
      },
      select: {
        id: true,
        createdAt: true,
        updatedAt: true,
        amount: true,
        mercadoPagoPaymentId: true,
        mercadoPagoStatus: true,
        mercadoPagoStatusDetail: true,
        mercadoPagoPaymentMethod: true,
        mercadoPagoTransactionId: true,
      },
      orderBy: {
        updatedAt: 'desc',
      },
    }))

    // También obtener la suscripción actual si tiene un pago
    const subscriptionPayments: any[] = []
    if (subscription) {
      const currentSubscription = await executeWithRetry(() => prisma.subscription.findFirst({
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
        orderBy: {
          updatedAt: 'desc',
        },
      }))

      if (currentSubscription) {
        subscriptionPayments.push({
          id: `sub-${currentSubscription.id}`,
          date: currentSubscription.updatedAt,
          amount: subscription.plan.price,
          currency: subscription.plan.currency,
          status: currentSubscription.mercadoPagoStatus === 'approved' ? 'Paid' :
                  currentSubscription.mercadoPagoStatus === 'rejected' || currentSubscription.mercadoPagoStatus === 'cancelled' ? 'Failed' :
                  currentSubscription.mercadoPagoStatus === 'refunded' || currentSubscription.mercadoPagoStatus === 'charged_back' ? 'Refunded' :
                  'Pending',
          mercadoPagoStatus: currentSubscription.mercadoPagoStatus,
          mercadoPagoStatusDetail: currentSubscription.mercadoPagoStatusDetail,
          paymentMethod: currentSubscription.mercadoPagoPaymentMethod,
          transactionId: currentSubscription.mercadoPagoTransactionId,
          mercadoPagoPaymentId: currentSubscription.mercadoPagoPaymentId,
          planName: subscription.plan.name,
          interval: subscription.plan.interval,
        })
      }
    }

    // Combinar pagos de Payment y suscripción, eliminando duplicados por mercadoPagoPaymentId
    const allPaymentsMap = new Map<string, any>()

    // Agregar pagos de la tabla Payment
    paymentRecords.forEach((payment) => {
      if (payment.mercadoPagoPaymentId) {
        let status = 'Pending'
        if (payment.mercadoPagoStatus === 'approved') {
          status = 'Paid'
        } else if (payment.mercadoPagoStatus === 'rejected' || payment.mercadoPagoStatus === 'cancelled') {
          status = 'Failed'
        } else if (payment.mercadoPagoStatus === 'pending' || payment.mercadoPagoStatus === 'in_process') {
          status = 'Pending'
        } else if (payment.mercadoPagoStatus === 'refunded' || payment.mercadoPagoStatus === 'charged_back') {
          status = 'Refunded'
        }

        allPaymentsMap.set(payment.mercadoPagoPaymentId, {
          id: payment.id,
          date: payment.updatedAt || payment.createdAt,
          amount: payment.amount,
          currency: subscription?.plan.currency || 'COP',
          status: status,
          mercadoPagoStatus: payment.mercadoPagoStatus,
          mercadoPagoStatusDetail: payment.mercadoPagoStatusDetail,
          paymentMethod: payment.mercadoPagoPaymentMethod,
          transactionId: payment.mercadoPagoTransactionId,
          mercadoPagoPaymentId: payment.mercadoPagoPaymentId,
          planName: subscription?.plan.name || 'N/A',
          interval: subscription?.plan.interval || 'monthly',
        })
      }
    })

    // Agregar pagos de suscripción (solo si no están ya en el mapa)
    subscriptionPayments.forEach((payment) => {
      if (payment.mercadoPagoPaymentId && !allPaymentsMap.has(payment.mercadoPagoPaymentId)) {
        allPaymentsMap.set(payment.mercadoPagoPaymentId, payment)
      }
    })

    // Convertir a array y ordenar por fecha
    let allPayments = Array.from(allPaymentsMap.values())
    allPayments.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

    // Aplicar paginación
    const total = allPayments.length
    const paginatedPayments = allPayments.slice(skip, skip + limit)

    const totalPages = Math.ceil(total / limit)

    return NextResponse.json({ 
      payments: paginatedPayments,
      total,
      page,
      limit,
      totalPages,
    })
  } catch (error: any) {
    // Obtener tenantId de forma segura para logging
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
        error: error.message || 'Error al obtener el historial de pagos',
        details: process.env.NODE_ENV === 'development' ? error?.message : undefined,
        code: error?.code || 'UNKNOWN_ERROR',
      },
      { status: 500 }
    )
  }
}

