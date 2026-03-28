import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-middleware'
import { prisma } from '@/lib/db'
import { getTransaction, mapWompiStatusToSubscription } from '@/lib/wompi'

export const dynamic = 'force-dynamic'

/**
 * GET /api/subscriptions/wompi/verify?ref=REFERENCE&id=TRANSACTION_ID
 * Verifies a Wompi transaction and activates the subscription
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

    console.log('[Wompi Verify] Starting:', { reference, transactionId, tenantId })

    // Find subscription by tenantId (each tenant has one subscription)
    // Don't rely on wompiReference column which may not exist in DB
    const subscription = await prisma.subscription.findUnique({
      where: { tenantId },
      include: { plan: true },
    })

    if (!subscription) {
      console.error('[Wompi Verify] No subscription found for tenant:', tenantId)
      return NextResponse.json({ error: 'Suscripción no encontrada' }, { status: 404 })
    }

    console.log('[Wompi Verify] Found subscription:', {
      id: subscription.id,
      status: subscription.status,
      planName: subscription.plan.name,
    })

    // If we have a transactionId, verify with Wompi API
    if (transactionId) {
      console.log('[Wompi Verify] Fetching transaction:', transactionId)
      const transaction = await getTransaction(transactionId)

      if (!transaction) {
        console.error('[Wompi Verify] getTransaction returned null for:', transactionId)
        return NextResponse.json({
          status: 'PENDING',
          message: 'No se pudo verificar la transacción con Wompi',
        })
      }

      console.log('[Wompi Verify] Transaction from Wompi:', {
        status: transaction.status,
        reference: transaction.reference,
      })

      const newStatus = mapWompiStatusToSubscription(transaction.status)

      // Read pending plan info from wompiResponse via raw SQL (column may or may not exist)
      let pendingPlanId = subscription.planId
      let pendingPlanName = subscription.plan.name
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
        console.warn('[Wompi Verify] Could not read wompiResponse:', (e as any)?.message)
      }

      // Calculate end date
      const endDate = new Date()
      if (subscription.plan.interval === 'annual') {
        endDate.setDate(endDate.getDate() + 365)
      } else {
        endDate.setDate(endDate.getDate() + 30)
      }

      if (newStatus === 'active') {
        console.log('[Wompi Verify] APPROVED! Activating plan:', pendingPlanId)
        // Update using Prisma for safe fields + raw SQL for Wompi fields
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
        // Try to update Wompi-specific columns (may not exist)
        try {
          await prisma.$executeRawUnsafe(
            `UPDATE "Subscription" SET "wompiTransactionId" = $1, "wompiStatus" = $2,
             "wompiPaymentMethod" = $3, "wompiResponse" = $4 WHERE "id" = $5`,
            transaction.id, transaction.status,
            transaction.payment_method_type, JSON.stringify(transaction),
            subscription.id
          )
        } catch (e) {
          console.warn('[Wompi Verify] Could not update wompi fields:', (e as any)?.message)
        }
      } else {
        console.log('[Wompi Verify] Not approved:', transaction.status)
        // Restore to active if was pending_payment
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
          console.warn('[Wompi Verify] Could not update wompi fields:', (e as any)?.message)
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
    }

    // No transactionId — return current status
    return NextResponse.json({
      status: 'PENDING',
      subscriptionStatus: subscription.status,
      reference,
    })
  } catch (error: any) {
    console.error('[Wompi Verify] Error:', error)
    return NextResponse.json({ error: error.message || 'Error interno' }, { status: 500 })
  }
}
