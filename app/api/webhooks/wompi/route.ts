import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { verifyEventSignature, mapWompiStatusToSubscription } from '@/lib/wompi'
import type { WompiEvent } from '@/lib/wompi'

export const dynamic = 'force-dynamic'

/**
 * POST /api/webhooks/wompi
 * Wompi event webhook — receives transaction.updated events
 * Public endpoint (no auth required), protected by SHA256 signature verification
 * 
 * Must return 200 or Wompi retries up to 3 times over 24h
 */
export async function POST(request: Request) {
  try {
    const event: WompiEvent = await request.json()

    // Only handle transaction.updated events
    if (event.event !== 'transaction.updated') {
      return NextResponse.json({ received: true })
    }

    // Verify signature
    const isValid = verifyEventSignature(event)
    if (!isValid) {
      console.error('[Wompi Webhook] Invalid signature for event:', event.event)
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }

    const transaction = event.data.transaction
    const { reference, status, id: transactionId, payment_method_type } = transaction

    console.log(`[Wompi Webhook] Transaction ${transactionId} — status: ${status}, ref: ${reference}`)

    // Find the subscription by reference
    const subscription = await prisma.subscription.findFirst({
      where: { wompiReference: reference },
      include: { plan: true },
    })

    if (!subscription) {
      console.warn(`[Wompi Webhook] No subscription found for reference: ${reference}`)
      return NextResponse.json({ received: true, warning: 'No subscription found' })
    }

    // Don't downgrade an already active subscription
    if (subscription.status === 'active' && status !== 'APPROVED') {
      console.log(`[Wompi Webhook] Skipping — subscription already active, tx status: ${status}`)
      return NextResponse.json({ received: true })
    }

    const newStatus = mapWompiStatusToSubscription(status)

    // Calculate end date
    const endDate = new Date()
    if (subscription.plan.interval === 'annual') {
      endDate.setDate(endDate.getDate() + 365)
    } else {
      endDate.setDate(endDate.getDate() + 30)
    }

    // Update subscription
    await prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        status: newStatus,
        wompiTransactionId: transactionId,
        wompiStatus: status,
        wompiPaymentMethod: payment_method_type,
        wompiResponse: JSON.stringify(transaction),
        ...(newStatus === 'active' ? {
          startDate: new Date(),
          endDate,
        } : {}),
      },
    })

    console.log(`[Wompi Webhook] Subscription ${subscription.id} updated to: ${newStatus}`)

    // Return 200 to acknowledge receipt
    return NextResponse.json({ received: true, status: newStatus })
  } catch (error: any) {
    console.error('[Wompi Webhook] Error processing event:', error)
    // Return 200 anyway to prevent Wompi from retrying on our errors
    return NextResponse.json({ received: true, error: error.message })
  }
}
