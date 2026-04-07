import { NextResponse } from 'next/server'
import { logger } from '@/lib/logger'
import { requireAuth } from '@/lib/api-middleware'
import { prisma } from '@/lib/db'
import { getTransaction, getTransactionByReference, mapWompiStatusToSubscription } from '@/lib/wompi'
import type { WompiTransaction } from '@/lib/wompi'

export const dynamic = 'force-dynamic'

/**
 * GET /api/subscriptions/wompi/verify?ref=REFERENCE&id=TRANSACTION_ID
 * Verifies a Wompi transaction and activates the subscription.
 * 
 * IMPORTANT: Wompi's Widget Checkout does NOT append the transaction ID
 * to the redirect URL. When `id` is missing, we search by reference.
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

    logger.info('[Wompi Verify] Found subscription:', {
      id: subscription.id,
      status: subscription.status,
      planName: subscription.plan.name,
    })

    // Resolve the transaction — by ID if available, otherwise search by reference
    let transaction: WompiTransaction | null = null
    if (transactionId) {
      logger.info('[Wompi Verify] Fetching transaction by ID:', transactionId)
      transaction = await getTransaction(transactionId)
    }
    
    if (!transaction && reference) {
      logger.info('[Wompi Verify] No transaction ID or lookup failed, searching by reference:', reference)
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

    const newStatus = mapWompiStatusToSubscription(transaction.status)

    // Get pending plan ID: from URL query param (most reliable) > wompiResponse column > current plan
    const queryPlanId = searchParams.get('planId')
    let pendingPlanId = subscription.planId
    let pendingPlanName = subscription.plan.name

    if (queryPlanId) {
      pendingPlanId = queryPlanId
      const targetPlan = await prisma.plan.findUnique({ where: { id: queryPlanId } })
      if (targetPlan) pendingPlanName = targetPlan.name
      logger.info('[Wompi Verify] Using planId from URL:', { pendingPlanId, pendingPlanName })
    } else {
      try {
        const rows: any[] = await prisma.$queryRawUnsafe(
          `SELECT "wompiResponse" FROM "Subscription" WHERE "id" = $1`,
          subscription.id
        )
        if (rows[0]?.wompiResponse) {
          const resp = JSON.parse(rows[0].wompiResponse)
          if (resp.pendingPlanId) {
            pendingPlanId = resp.pendingPlanId
            pendingPlanName = resp.pendingPlanName || pendingPlanName
          }
        }
      } catch (e) {
        logger.warn('[Wompi Verify] Could not read wompiResponse:', (e as any)?.message)
      }
    }

    // Calculate end date
    const endDate = new Date()
    if (subscription.plan.interval === 'annual') {
      endDate.setDate(endDate.getDate() + 365)
    } else {
      endDate.setDate(endDate.getDate() + 30)
    }

    if (newStatus === 'active') {
      logger.info('[Wompi Verify] APPROVED! Activating plan:', pendingPlanId)
      await prisma.subscription.update({
        where: { id: subscription.id },
        data: {
          status: 'active',
          planId: pendingPlanId,
          startDate: new Date(),
          endDate,
          autoRenew: true,
        },
      })
      try {
        await prisma.$executeRawUnsafe(
          `UPDATE "Subscription" SET "wompiTransactionId" = $1, "wompiStatus" = $2,
           "wompiPaymentMethod" = $3, "wompiResponse" = $4 WHERE "id" = $5`,
          transaction.id, transaction.status,
          transaction.payment_method_type, JSON.stringify(transaction),
          subscription.id
        )
      } catch (e) {
        logger.warn('[Wompi Verify] Could not update wompi fields:', (e as any)?.message)
      }
    } else if (transaction.status === 'DECLINED' || transaction.status === 'VOIDED' || transaction.status === 'ERROR') {
      logger.info('[Wompi Verify] Payment failed:', transaction.status)
      // Restore to active if was pending_payment (don't lock user out)
      if (subscription.status === 'pending_payment') {
        await prisma.subscription.update({
          where: { id: subscription.id },
          data: { status: 'active' },
        })
      }
      try {
        await prisma.$executeRawUnsafe(
          `UPDATE "Subscription" SET "wompiTransactionId" = $1, "wompiStatus" = $2,
           "wompiPaymentMethod" = $3, "wompiResponse" = $4 WHERE "id" = $5`,
          transaction.id, transaction.status,
          transaction.payment_method_type, JSON.stringify(transaction),
          subscription.id
        )
      } catch (e) {
        logger.warn('[Wompi Verify] Could not update wompi fields:', (e as any)?.message)
      }
    }

    // Fetch updated plan name for the response
    let responsePlanName = pendingPlanName
    if (newStatus === 'active' && pendingPlanId !== subscription.planId) {
      const newPlan = await prisma.plan.findUnique({ where: { id: pendingPlanId } })
      if (newPlan) responsePlanName = newPlan.name
    }

    return NextResponse.json({
      status: transaction.status,
      subscriptionStatus: newStatus,
      subscription: {
        id: subscription.id,
        planName: newStatus === 'active' ? responsePlanName : subscription.plan.name,
        startDate: newStatus === 'active' ? new Date() : subscription.startDate,
        endDate: newStatus === 'active' ? endDate : subscription.endDate,
      },
    })
  } catch (error: any) {
    logger.error('[Wompi Verify] Error:', error)
    return NextResponse.json({ error: error.message || 'Error interno' }, { status: 500 })
  }
}
