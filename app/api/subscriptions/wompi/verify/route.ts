import { NextResponse } from 'next/server'
import { logger } from '@/lib/logger'
import { requireAuth } from '@/lib/api-middleware'
import { prisma } from '@/lib/db'
import { getTransaction, getTransactionByReference, calculateEndDate } from '@/lib/wompi'
import type { WompiTransaction } from '@/lib/wompi'

export const dynamic = 'force-dynamic'

/**
 * GET /api/subscriptions/wompi/verify?ref=REFERENCE&id=TRANSACTION_ID&planId=PLAN_ID
 * 
 * Called when user is redirected back from Wompi Widget.
 * Verifies the transaction status and activates the subscription if APPROVED.
 * 
 * RACE CONDITION SAFETY: Uses optimistic locking — checks current status
 * before writing to avoid overwriting a webhook that already processed this.
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
    const queryPlanId = searchParams.get('planId')

    if (!reference) {
      return NextResponse.json({ error: 'ref es requerido' }, { status: 400 })
    }

    logger.info('[Wompi Verify] Starting:', { reference, transactionId, tenantId })

    // Find subscription by tenantId
    const subscription = await prisma.subscription.findUnique({
      where: { tenantId },
      include: { plan: true },
    })

    if (!subscription) {
      logger.error('[Wompi Verify] No subscription found for tenant:', tenantId)
      return NextResponse.json({ error: 'Suscripción no encontrada' }, { status: 404 })
    }

    // OPTIMISTIC LOCK: If the webhook already activated this subscription, skip
    if (subscription.status === 'active' && subscription.wompiStatus === 'APPROVED' && subscription.wompiTransactionId) {
      logger.info('[Wompi Verify] Already activated by webhook — returning current state')
      return NextResponse.json({
        status: 'APPROVED',
        subscriptionStatus: 'active',
        subscription: {
          id: subscription.id,
          planName: subscription.plan.name,
          startDate: subscription.startDate,
          endDate: subscription.endDate,
        },
      })
    }

    // Resolve the transaction — by ID if available, otherwise search by reference
    let transaction: WompiTransaction | null = null
    if (transactionId) {
      logger.info('[Wompi Verify] Fetching transaction by ID:', transactionId)
      transaction = await getTransaction(transactionId)
    }
    
    if (!transaction && reference) {
      logger.info('[Wompi Verify] Searching by reference:', reference)
      transaction = await getTransactionByReference(reference)
    }

    if (!transaction) {
      logger.info('[Wompi Verify] No transaction found yet (may still be processing)')
      return NextResponse.json({
        status: 'PENDING',
        message: 'La transacción aún está siendo procesada por Wompi',
        subscriptionStatus: subscription.status,
        reference,
      })
    }

    logger.info('[Wompi Verify] Transaction from Wompi:', {
      id: transaction.id,
      status: transaction.status,
      reference: transaction.reference,
    })

    // Resolve the target plan ID: from URL > from wompiResponse > current plan
    let pendingPlanId = subscription.planId
    let pendingPlanName = subscription.plan.name
    let pendingPlanInterval = subscription.plan.interval

    if (queryPlanId) {
      const targetPlan = await prisma.plan.findUnique({ where: { id: queryPlanId } })
      if (targetPlan) {
        pendingPlanId = targetPlan.id
        pendingPlanName = targetPlan.name
        pendingPlanInterval = targetPlan.interval
      }
    } else if (subscription.wompiResponse) {
      try {
        const resp = JSON.parse(subscription.wompiResponse)
        if (resp.pendingPlanId) {
          const targetPlan = await prisma.plan.findUnique({ where: { id: resp.pendingPlanId } })
          if (targetPlan) {
            pendingPlanId = targetPlan.id
            pendingPlanName = targetPlan.name
            pendingPlanInterval = targetPlan.interval
          }
        }
      } catch {
        // JSON parse failed — use current plan
      }
    }

    if (transaction.status === 'APPROVED') {
      // ✅ APPROVED — Activate with the TARGET plan's interval
      logger.info('[Wompi Verify] APPROVED! Activating plan:', pendingPlanId)
      const endDate = calculateEndDate(pendingPlanInterval)

      await prisma.subscription.update({
        where: { id: subscription.id },
        data: {
          status: 'active',
          planId: pendingPlanId,
          wompiTransactionId: transaction.id,
          wompiStatus: transaction.status,
          wompiPaymentMethod: transaction.payment_method_type,
          wompiResponse: JSON.stringify(transaction),
          startDate: new Date(),
          endDate,
          autoRenew: true,
        },
      })

      return NextResponse.json({
        status: 'APPROVED',
        subscriptionStatus: 'active',
        subscription: {
          id: subscription.id,
          planName: pendingPlanName,
          startDate: new Date(),
          endDate,
        },
      })
    } else if (['DECLINED', 'VOIDED', 'ERROR'].includes(transaction.status)) {
      // ❌ FAILED — Restore to active if was pending_payment (don't lock user out)
      logger.info('[Wompi Verify] Payment failed:', transaction.status)
      const restoredStatus = subscription.status === 'pending_payment' ? 'active' : subscription.status

      await prisma.subscription.update({
        where: { id: subscription.id },
        data: {
          status: restoredStatus,
          wompiTransactionId: transaction.id,
          wompiStatus: transaction.status,
          wompiPaymentMethod: transaction.payment_method_type,
          wompiResponse: JSON.stringify(transaction),
        },
      })

      return NextResponse.json({
        status: transaction.status,
        subscriptionStatus: restoredStatus,
        subscription: {
          id: subscription.id,
          planName: subscription.plan.name,
          startDate: subscription.startDate,
          endDate: subscription.endDate,
        },
      })
    }

    // PENDING — still processing
    return NextResponse.json({
      status: transaction.status,
      subscriptionStatus: subscription.status,
      subscription: {
        id: subscription.id,
        planName: subscription.plan.name,
        startDate: subscription.startDate,
        endDate: subscription.endDate,
      },
    })
  } catch (error: any) {
    logger.error('[Wompi Verify] Error:', error)
    return NextResponse.json({ error: error.message || 'Error interno' }, { status: 500 })
  }
}
