import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-middleware'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

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

    // Obtener todas las suscripciones del tenant que tienen pagos aprobados
    const subscriptions = await prisma.subscription.findMany({
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
    })

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

