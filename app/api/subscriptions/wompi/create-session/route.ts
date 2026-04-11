import { NextResponse } from 'next/server'
import { logger } from '@/lib/logger'
import { requireAuth } from '@/lib/api-middleware'
import { prisma } from '@/lib/db'
import { generateReference, createPaymentSession } from '@/lib/wompi'

export const dynamic = 'force-dynamic'

/**
 * POST /api/subscriptions/wompi/create-session
 * 
 * Creates a payment session for the Wompi Widget checkout.
 * Stores the reference and pending plan ID using typed Prisma fields.
 * 
 * Flow:
 * 1. Validate plan exists and is paid
 * 2. Generate unique reference + integrity signature
 * 3. Upsert subscription to pending_payment (preserving current planId)
 * 4. Store wompiReference + pendingPlanId
 * 5. Return Widget data to frontend
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

    // Build redirect URL
    const baseUrl = process.env.NODE_ENV === 'production'
      ? 'https://www.clientumstudio.com'
      : (process.env.NEXTAUTH_URL || 'http://localhost:3000')
    const redirectUrl = `${baseUrl}/settings?tab=subscription&wompiRef=${reference}&planId=${plan.id}`

    // Create payment session data
    logger.info('[Wompi] Creating session:', {
      reference,
      amountInCents,
      currency: plan.currency || 'COP',
      planId: plan.id,
      planName: plan.name,
      planPrice: plan.price,
    })
    const paymentSession = createPaymentSession(reference, amountInCents, redirectUrl, plan.currency || 'COP')

    // Upsert subscription — set to pending_payment, store reference + pending plan
    // IMPORTANT: Do NOT change planId here. Only change it when payment is APPROVED.
    await prisma.subscription.upsert({
      where: { tenantId },
      update: {
        status: 'pending_payment',
        autoRenew: true,
        wompiReference: reference,
        wompiStatus: 'PENDING',
        wompiResponse: JSON.stringify({ pendingPlanId: plan.id, pendingPlanName: plan.name }),
      },
      create: {
        tenantId,
        planId: plan.id, // Only for brand new subscriptions
        status: 'pending_payment',
        startDate: new Date(),
        autoRenew: true,
        wompiReference: reference,
        wompiStatus: 'PENDING',
        wompiResponse: JSON.stringify({ pendingPlanId: plan.id, pendingPlanName: plan.name }),
      },
    })

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
