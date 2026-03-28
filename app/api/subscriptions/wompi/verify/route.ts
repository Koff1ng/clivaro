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

    // Find the pending subscription by reference using raw SQL (column may not exist in Prisma types yet)
    const subscriptions: any[] = await prisma.$queryRawUnsafe(
      `SELECT s.*, p."name" as "planName", p."interval" as "planInterval", p."price" as "planPrice"
       FROM "Subscription" s
       JOIN "Plan" p ON s."planId" = p."id"
       WHERE s."tenantId" = $1 AND s."wompiReference" = $2 AND s."status" = 'pending_payment'
       LIMIT 1`,
      tenantId,
      reference
    )

    const subscription = subscriptions[0]

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

      if (transaction.reference !== reference) {
        return NextResponse.json({ error: 'Referencia no coincide' }, { status: 400 })
      }

      const newStatus = mapWompiStatusToSubscription(transaction.status)

      // Calculate end date
      const endDate = new Date()
      if (subscription.planInterval === 'annual') {
        endDate.setDate(endDate.getDate() + 365)
      } else {
        endDate.setDate(endDate.getDate() + 30)
      }

      // Update subscription with raw SQL
      if (newStatus === 'active') {
        await prisma.$executeRawUnsafe(
          `UPDATE "Subscription" SET
            "status" = $1, "wompiTransactionId" = $2, "wompiStatus" = $3,
            "wompiPaymentMethod" = $4, "wompiResponse" = $5,
            "startDate" = $6, "endDate" = $7, "updatedAt" = NOW()
           WHERE "id" = $8`,
          newStatus, transaction.id, transaction.status,
          transaction.payment_method_type, JSON.stringify(transaction),
          new Date(), endDate, subscription.id
        )
      } else {
        await prisma.$executeRawUnsafe(
          `UPDATE "Subscription" SET
            "status" = $1, "wompiTransactionId" = $2, "wompiStatus" = $3,
            "wompiPaymentMethod" = $4, "wompiResponse" = $5, "updatedAt" = NOW()
           WHERE "id" = $6`,
          newStatus, transaction.id, transaction.status,
          transaction.payment_method_type, JSON.stringify(transaction),
          subscription.id
        )
      }

      return NextResponse.json({
        status: transaction.status,
        subscriptionStatus: newStatus,
        subscription: {
          id: subscription.id,
          planName: subscription.planName,
          startDate: newStatus === 'active' ? new Date() : subscription.startDate,
          endDate: newStatus === 'active' ? endDate : subscription.endDate,
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
