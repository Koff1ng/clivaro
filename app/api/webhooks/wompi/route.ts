import { NextResponse } from 'next/server'
import { logger } from '@/lib/logger'
import { prisma } from '@/lib/db'
import { verifyEventSignature, mapWompiStatusToSubscription } from '@/lib/wompi'
import type { WompiEvent } from '@/lib/wompi'

export const dynamic = 'force-dynamic'

/**
 * POST /api/webhooks/wompi
 * Wompi event webhook — receives transaction.updated events
 * Public endpoint protegido por verificación SHA256 de firma
 */
export async function POST(request: Request) {
  try {
    const event: WompiEvent = await request.json()

    if (event.event !== 'transaction.updated') {
      return NextResponse.json({ received: true })
    }

    const isValid = verifyEventSignature(event)
    if (!isValid) {
      logger.error('[Wompi Webhook] Invalid signature')
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }

    const { reference, status, id: transactionId, payment_method_type } = event.data.transaction

    logger.info(`[Wompi Webhook] Transaction ${transactionId} — status: ${status}, ref: ${reference}`)

    // Find subscription by reference using raw SQL
    const subscriptions: any[] = await prisma.$queryRawUnsafe(
      `SELECT s.*, p."interval" as "planInterval"
       FROM "Subscription" s
       JOIN "Plan" p ON s."planId" = p."id"
       WHERE s."wompiReference" = $1
       LIMIT 1`,
      reference
    )

    const subscription = subscriptions[0]

    if (!subscription) {
      logger.warn(`[Wompi Webhook] No subscription for ref: ${reference}`)
      return NextResponse.json({ received: true, warning: 'No subscription found' })
    }

    if (subscription.status === 'active' && status !== 'APPROVED') {
      return NextResponse.json({ received: true })
    }

    const newStatus = mapWompiStatusToSubscription(status)

    // Parse pending plan info from wompiResponse
    let pendingPlanId = subscription.planId
    try {
      const resp = subscription.wompiResponse ? JSON.parse(subscription.wompiResponse) : {}
      if (resp.pendingPlanId) pendingPlanId = resp.pendingPlanId
    } catch {}

    const endDate = new Date()
    if (subscription.planInterval === 'annual') {
      endDate.setDate(endDate.getDate() + 365)
    } else {
      endDate.setDate(endDate.getDate() + 30)
    }

    // Update with raw SQL
    if (newStatus === 'active') {
      // APPROVED: update planId + activate
      await prisma.$executeRawUnsafe(
        `UPDATE "Subscription" SET
          "status" = $1, "planId" = $2, "wompiTransactionId" = $3, "wompiStatus" = $4,
          "wompiPaymentMethod" = $5, "wompiResponse" = $6,
          "startDate" = $7, "endDate" = $8, "updatedAt" = NOW()
         WHERE "id" = $9`,
        newStatus, pendingPlanId, transactionId, status,
        payment_method_type, JSON.stringify(event.data.transaction),
        new Date(), endDate, subscription.id
      )
    } else {
      // DECLINED/ERROR: restore previous status, keep original planId
      await prisma.$executeRawUnsafe(
        `UPDATE "Subscription" SET
          "status" = $1, "wompiTransactionId" = $2, "wompiStatus" = $3,
          "wompiPaymentMethod" = $4, "wompiResponse" = $5, "updatedAt" = NOW()
         WHERE "id" = $6`,
        subscription.status === 'pending_payment' ? 'active' : newStatus,
        transactionId, status,
        payment_method_type, JSON.stringify(event.data.transaction),
        subscription.id
      )
    }

    logger.info(`[Wompi Webhook] Subscription ${subscription.id} → ${newStatus}`)
    return NextResponse.json({ received: true, status: newStatus })
  } catch (error: any) {
    logger.error('[Wompi Webhook] Error:', error)
    return NextResponse.json({ received: true, error: error.message })
  }
}
