import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-middleware'
import { prisma } from '@/lib/db'
import { getTransaction, mapWompiStatusToSubscription } from '@/lib/wompi'

export const dynamic = 'force-dynamic'

/**
 * GET /api/subscriptions/wompi/verify?ref=REFERENCE&id=TRANSACTION_ID
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

    // Diagnostics
    const hasPrivateKey = !!process.env.WOMPI_PRIVATE_KEY
    const apiUrl = process.env.WOMPI_API_URL || 'https://sandbox.wompi.co/v1'
    console.log('[Wompi Verify] Starting:', { reference, transactionId, hasPrivateKey, apiUrl, tenantId })

    // Find subscription by reference — try with pending_payment first, then any status
    let subscriptions: any[] = await prisma.$queryRawUnsafe(
      `SELECT s.*, p."name" as "planName", p."interval" as "planInterval", p."price" as "planPrice"
       FROM "Subscription" s
       JOIN "Plan" p ON s."planId" = p."id"
       WHERE s."tenantId" = $1 AND s."wompiReference" = $2
       LIMIT 1`,
      tenantId,
      reference
    )

    let subscription = subscriptions[0]

    // Fallback: find any subscription for this tenant
    if (!subscription) {
      console.log('[Wompi Verify] No subscription found by reference, trying by tenantId...')
      subscriptions = await prisma.$queryRawUnsafe(
        `SELECT s.*, p."name" as "planName", p."interval" as "planInterval", p."price" as "planPrice"
         FROM "Subscription" s
         JOIN "Plan" p ON s."planId" = p."id"
         WHERE s."tenantId" = $1
         ORDER BY s."updatedAt" DESC
         LIMIT 1`,
        tenantId
      )
      subscription = subscriptions[0]
    }

    if (!subscription) {
      console.error('[Wompi Verify] No subscription found at all for tenant:', tenantId)
      return NextResponse.json({ error: 'Suscripción no encontrada', debug: { tenantId, reference } }, { status: 404 })
    }

    console.log('[Wompi Verify] Found subscription:', { id: subscription.id, status: subscription.status, planName: subscription.planName })

    // If we have a transactionId, verify with Wompi API
    if (transactionId) {
      if (!hasPrivateKey) {
        console.error('[Wompi Verify] WOMPI_PRIVATE_KEY is NOT set! Cannot verify transaction.')
        return NextResponse.json({
          status: 'CONFIGURATION_ERROR',
          message: 'Configuración incompleta del servidor — contacta soporte',
          debug: { missingKey: 'WOMPI_PRIVATE_KEY' },
        }, { status: 500 })
      }

      console.log('[Wompi Verify] Fetching transaction from Wompi API:', transactionId)
      const transaction = await getTransaction(transactionId)

      if (!transaction) {
        console.error('[Wompi Verify] getTransaction returned null for:', transactionId)
        return NextResponse.json({
          status: 'PENDING',
          message: 'No se pudo verificar la transacción con Wompi',
          debug: { transactionId, apiUrl },
        })
      }

      console.log('[Wompi Verify] Transaction from Wompi:', { status: transaction.status, reference: transaction.reference, id: transaction.id })

      // Reference validation — warn but don't block
      if (transaction.reference !== reference) {
        console.warn('[Wompi Verify] Reference mismatch:', { expected: reference, got: transaction.reference })
      }

      const newStatus = mapWompiStatusToSubscription(transaction.status)

      // Parse pending plan info from wompiResponse
      let pendingPlanId = subscription.planId
      let pendingPlanName = subscription.planName
      try {
        const resp = subscription.wompiResponse ? JSON.parse(subscription.wompiResponse) : {}
        if (resp.pendingPlanId) {
          pendingPlanId = resp.pendingPlanId
          pendingPlanName = resp.pendingPlanName || pendingPlanName
        }
      } catch {}

      // Calculate end date
      const endDate = new Date()
      if (subscription.planInterval === 'annual') {
        endDate.setDate(endDate.getDate() + 365)
      } else {
        endDate.setDate(endDate.getDate() + 30)
      }

      // Update subscription
      if (newStatus === 'active') {
        console.log('[Wompi Verify] APPROVED! Activating plan:', { pendingPlanId, pendingPlanName })
        await prisma.$executeRawUnsafe(
          `UPDATE "Subscription" SET
            "status" = $1, "planId" = $2, "wompiTransactionId" = $3, "wompiStatus" = $4,
            "wompiPaymentMethod" = $5, "wompiResponse" = $6,
            "startDate" = $7, "endDate" = $8, "updatedAt" = NOW()
           WHERE "id" = $9`,
          newStatus, pendingPlanId, transaction.id, transaction.status,
          transaction.payment_method_type, JSON.stringify(transaction),
          new Date(), endDate, subscription.id
        )
      } else {
        console.log('[Wompi Verify] Not approved:', { wompiStatus: transaction.status, newStatus })
        await prisma.$executeRawUnsafe(
          `UPDATE "Subscription" SET
            "status" = $1, "wompiTransactionId" = $2, "wompiStatus" = $3,
            "wompiPaymentMethod" = $4, "wompiResponse" = $5, "updatedAt" = NOW()
           WHERE "id" = $6`,
          subscription.status === 'pending_payment' ? 'active' : newStatus,
          transaction.id, transaction.status,
          transaction.payment_method_type, JSON.stringify(transaction),
          subscription.id
        )
      }

      return NextResponse.json({
        status: transaction.status,
        subscriptionStatus: newStatus,
        subscription: {
          id: subscription.id,
          planName: newStatus === 'active' ? pendingPlanName : subscription.planName,
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
