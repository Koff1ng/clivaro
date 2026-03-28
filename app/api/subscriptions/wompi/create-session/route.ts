import { NextResponse } from 'next/server'
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

    // Build redirect URL
    const baseUrl = process.env.NEXTAUTH_URL || process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : 'http://localhost:3000'
    const redirectUrl = `${baseUrl}/settings/billing?wompiRef=${reference}`

    // Create payment session data
    const paymentSession = createPaymentSession(reference, amountInCents, redirectUrl, plan.currency || 'COP')

    // Upsert subscription as pending_payment
    // Cancel any existing active subscriptions first
    await prisma.subscription.updateMany({
      where: { tenantId, status: { in: ['active', 'trial', 'pending_payment'] } },
      data: { status: 'cancelled' },
    })

    await prisma.subscription.create({
      data: {
        tenantId,
        planId: plan.id,
        status: 'pending_payment',
        startDate: new Date(),
        wompiReference: reference,
        autoRenew: true,
      },
    })

    return NextResponse.json({
      ...paymentSession,
      planName: plan.name,
      planPrice: plan.price,
    })
  } catch (error: any) {
    console.error('[Wompi] Error creating session:', error)
    return NextResponse.json({ error: error.message || 'Error interno' }, { status: 500 })
  }
}
