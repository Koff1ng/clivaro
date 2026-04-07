import { NextResponse } from 'next/server'
import { logger } from '@/lib/logger'
import { requireAuth } from '@/lib/api-middleware'
import { prisma } from '@/lib/db'
import { generateReference, createPaymentSession } from '@/lib/wompi'

export const dynamic = 'force-dynamic'

/**
 * POST /api/subscriptions/wompi/create-session
 * Creates or updates a subscription to pending_payment and returns Widget data
 */
export async function POST(request: Request) {
  try {
    const session = await requireAuth(request)
    if (session instanceof NextResponse) return session

    const user = session.user as any
    const tenantId = user.tenantId

    if (!tenantId) {
      return NextResponse.json({ error: 'No tenant associated' }, { status: 400 })
    }

    const { planId } = await request.json()
    if (!planId) {
      return NextResponse.json({ error: 'planId es requerido' }, { status: 400 })
    }

    // Get the plan
    const plan = await prisma.plan.findUnique({ where: { id: planId } })
    if (!plan || !plan.active) {
      return NextResponse.json({ error: 'Plan no encontrado o inactivo' }, { status: 404 })
    }

    if (plan.price <= 0) {
      return NextResponse.json({ error: 'El plan gratuito no requiere pago' }, { status: 400 })
    }

    // Generate unique reference
    const reference = generateReference(tenantId)
    const amountInCents = Math.round(plan.price * 100) // Convert COP to centavos

    // Build redirect URL — must use the actual production domain
    // NOT VERCEL_URL (which gives clivaro.vercel.app — wrong domain, breaks auth)
    const baseUrl = process.env.NODE_ENV === 'production'
      ? 'https://www.clientumstudio.com'
      : (process.env.NEXTAUTH_URL || 'http://localhost:3000')
    const redirectUrl = `${baseUrl}/settings?tab=subscription&wompiRef=${reference}&planId=${plan.id}`

    // Create payment session data
    logger.info('[Wompi] Creating session:', {
      reference,
      amountInCents,
      currency: plan.currency || 'COP',
      hasIntegritySecret: !!process.env.WOMPI_INTEGRITY_SECRET,
      hasPublicKey: !!process.env.WOMPI_PUBLIC_KEY || !!process.env.NEXT_PUBLIC_WOMPI_PUBLIC_KEY,
      planPrice: plan.price,
    })
    const paymentSession = createPaymentSession(reference, amountInCents, redirectUrl, plan.currency || 'COP')

    // Upsert subscription — only change status, NOT planId
    // The planId is only updated when payment is APPROVED (verify/webhook)
    const sub = await prisma.subscription.upsert({
      where: { tenantId },
      update: {
        status: 'pending_payment',
        autoRenew: true,
      },
      create: {
        tenantId,
        planId: plan.id, // Only set planId for brand new subscriptions
        status: 'pending_payment',
        startDate: new Date(),
        autoRenew: true,
      },
    })

    // Store reference + pending plan info via raw SQL (fields not in Prisma schema)
    try {
      await prisma.$executeRawUnsafe(
        `UPDATE "Subscription" SET "wompiReference" = $1, "wompiResponse" = $2 WHERE "id" = $3`,
        reference,
        JSON.stringify({ pendingPlanId: plan.id, pendingPlanName: plan.name }),
        sub.id
      )
    } catch (e) {
      logger.warn('[Wompi] wompi fields update failed:', (e as any)?.message)
    }

    return NextResponse.json({
      ...paymentSession,
      planName: plan.name,
      planPrice: plan.price,
    })
  } catch (error: any) {
    logger.error('[Wompi] Error creating session:', error)
    return NextResponse.json({ error: error.message || 'Error interno' }, { status: 500 })
  }
}
