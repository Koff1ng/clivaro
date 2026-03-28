import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-middleware'
import { prisma } from '@/lib/db'
import { getTransaction, mapWompiStatusToSubscription } from '@/lib/wompi'

export const dynamic = 'force-dynamic'

/**
 * GET /api/subscriptions/wompi/verify?ref=REFERENCE
 * Verifies a Wompi transaction by reference and activates the subscription
 */
export async function GET(request: Request) {
  try {
    const session = await requireAuth(request)
    if (session instanceof NextResponse) return session

    const user = session.user as any
    const tenantId = user.tenantId

    if (!tenantId) {
      return NextResponse.json({ error: 'No tenant associated' }, { status: 400 })
    }

    const { searchParams } = new URL(request.url)
    const reference = searchParams.get('ref')
    const transactionId = searchParams.get('id')

    if (!reference) {
      return NextResponse.json({ error: 'ref es requerido' }, { status: 400 })
    }

    // Find the pending subscription by reference
    const subscription = await prisma.subscription.findFirst({
      where: {
        tenantId,
        wompiReference: reference,
        status: 'pending_payment',
      },
      include: { plan: true },
    })

    if (!subscription) {
      return NextResponse.json({ error: 'Suscripción no encontrada' }, { status: 404 })
    }

    // If we have a transactionId, verify directly with Wompi API
    if (transactionId) {
      const transaction = await getTransaction(transactionId)

      if (!transaction) {
        return NextResponse.json({
          status: 'pending',
          message: 'No se pudo verificar la transacción aún',
        })
      }

      // Verify that the reference matches
      if (transaction.reference !== reference) {
        return NextResponse.json({ error: 'Referencia no coincide' }, { status: 400 })
      }

      const newStatus = mapWompiStatusToSubscription(transaction.status)

      // Calculate end date (30 days for monthly, 365 for annual)
      const endDate = new Date()
      if (subscription.plan.interval === 'annual') {
        endDate.setDate(endDate.getDate() + 365)
      } else {
        endDate.setDate(endDate.getDate() + 30)
      }

      // Update subscription
      const updated = await prisma.subscription.update({
        where: { id: subscription.id },
        data: {
          status: newStatus,
          wompiTransactionId: transaction.id,
          wompiStatus: transaction.status,
          wompiPaymentMethod: transaction.payment_method_type,
          wompiResponse: JSON.stringify(transaction),
          ...(newStatus === 'active' ? {
            startDate: new Date(),
            endDate,
          } : {}),
        },
        include: { plan: true },
      })

      return NextResponse.json({
        status: transaction.status,
        subscriptionStatus: newStatus,
        subscription: {
          id: updated.id,
          planName: updated.plan.name,
          startDate: updated.startDate,
          endDate: updated.endDate,
        },
      })
    }

    // No transactionId yet — return current status
    return NextResponse.json({
      status: 'pending',
      subscriptionStatus: subscription.status,
      reference,
    })
  } catch (error: any) {
    console.error('[Wompi] Error verifying:', error)
    return NextResponse.json({ error: error.message || 'Error interno' }, { status: 500 })
  }
}
