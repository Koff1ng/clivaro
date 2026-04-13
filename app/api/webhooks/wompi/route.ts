import { NextResponse } from 'next/server'
import { logger } from '@/lib/logger'
import { prisma } from '@/lib/db'
import { verifyEventSignature, calculateEndDate } from '@/lib/wompi'
import type { WompiEvent } from '@/lib/wompi'

export const dynamic = 'force-dynamic'
import { safeErrorMessage } from '@/lib/safe-error'

/**
 * POST /api/webhooks/wompi
 * 
 * Receives transaction.updated events from Wompi.
 * Protected by SHA256 signature verification.
 * 
 * IDEMPOTENCY: Checks if this transaction was already processed 
 * to prevent duplicate updates (Wompi may retry delivery).
 * 
 * SAFETY: Never cancels an active subscription on payment failure.
 * A failed upgrade attempt preserves the user's current plan.
 */
export async function POST(request: Request) {
  try {
    const event: WompiEvent = await request.json()

    // Only process transaction updates
    if (event.event !== 'transaction.updated') {
      return NextResponse.json({ received: true })
    }

    // Verify signature authenticity
    const isValid = verifyEventSignature(event)
    if (!isValid) {
      logger.error('[Wompi Webhook] Invalid signature — rejecting event')
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }

    const { reference, status, id: transactionId, payment_method_type } = event.data.transaction

    logger.info(`[Wompi Webhook] Event received — tx: ${transactionId}, status: ${status}, ref: ${reference}`)

    // Find subscription by Wompi reference using Prisma (typed, safe)
    const subscription = await prisma.subscription.findFirst({
      where: { wompiReference: reference },
      include: { plan: true },
    })

    if (!subscription) {
      logger.warn(`[Wompi Webhook] No subscription found for ref: ${reference}`)
      return NextResponse.json({ received: true, warning: 'No subscription found' })
    }

    // IDEMPOTENCY: If this exact transaction was already processed, skip
    if (subscription.wompiTransactionId === transactionId && subscription.wompiStatus === status) {
      logger.info(`[Wompi Webhook] Transaction ${transactionId} already processed with status ${status} — skipping`)
      return NextResponse.json({ received: true, skipped: true })
    }

    // Don't downgrade an already active+paid subscription on non-APPROVED events
    if (subscription.status === 'active' && subscription.wompiStatus === 'APPROVED' && status !== 'APPROVED') {
      logger.info(`[Wompi Webhook] Ignoring ${status} for already-active subscription ${subscription.id}`)
      // Still record the transaction data for audit
      await prisma.subscription.update({
        where: { id: subscription.id },
        data: {
          wompiResponse: JSON.stringify(event.data.transaction),
        },
      })
      return NextResponse.json({ received: true })
    }

    // Parse pending plan info from wompiResponse
    let pendingPlanId = subscription.planId
    let pendingPlanInterval = subscription.plan.interval
    try {
      const resp = subscription.wompiResponse ? JSON.parse(subscription.wompiResponse) : {}
      if (resp.pendingPlanId) {
        pendingPlanId = resp.pendingPlanId
        // Fetch the actual plan to get the correct interval
        const targetPlan = await prisma.plan.findUnique({ where: { id: resp.pendingPlanId } })
        if (targetPlan) {
          pendingPlanInterval = targetPlan.interval
        }
      }
    } catch {
      // JSON parse failed — use current plan
    }

    if (status === 'APPROVED') {
      // ✅ PAYMENT APPROVED — Activate and update planId
      const endDate = calculateEndDate(pendingPlanInterval)

      await prisma.subscription.update({
        where: { id: subscription.id },
        data: {
          status: 'active',
          planId: pendingPlanId,
          wompiTransactionId: transactionId,
          wompiStatus: status,
          wompiPaymentMethod: payment_method_type,
          wompiResponse: JSON.stringify(event.data.transaction),
          startDate: new Date(),
          endDate,
        },
      })

      logger.info(`[Wompi Webhook] ✅ Subscription ${subscription.id} activated — plan: ${pendingPlanId}, endDate: ${endDate.toISOString()}`)
    } else {
      // ❌ PAYMENT FAILED (DECLINED/VOIDED/ERROR)
      // NEVER cancel an active subscription — just record the failure
      const preservedStatus = subscription.status === 'pending_payment' ? 'active' : subscription.status

      await prisma.subscription.update({
        where: { id: subscription.id },
        data: {
          // Restore to previous status (active if was pending_payment)
          status: preservedStatus,
          wompiTransactionId: transactionId,
          wompiStatus: status,
          wompiPaymentMethod: payment_method_type,
          wompiResponse: JSON.stringify(event.data.transaction),
          // Do NOT change planId — keep the original plan
        },
      })

      logger.info(`[Wompi Webhook] ❌ Payment ${status} for subscription ${subscription.id} — status restored to: ${preservedStatus}`)
    }

    return NextResponse.json({ received: true, status })
  } catch (error: any) {
    logger.error('[Wompi Webhook] Error:', error)
    // Always return 200 to prevent Wompi from retrying indefinitely
    return NextResponse.json({ received: true, error: safeErrorMessage(error) })
  }
}
