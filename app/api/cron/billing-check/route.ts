import { NextResponse } from 'next/server'
import { logger } from '@/lib/logger'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

/**
 * GET /api/cron/billing-check
 * 
 * Cron job (Vercel Cron / External) — Runs daily to:
 * 1. Identify subscriptions past their endDate that are still 'active'
 * 2. Mark them as 'expired'
 * 3. Suspend tenants whose grace period has also passed
 * 
 * Protection: Requires CRON_SECRET header for production
 */
export async function GET(request: Request) {
  try {
    // Auth check for production
    const cronSecret = process.env.CRON_SECRET
    const authHeader = request.headers.get('authorization')
    
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const now = new Date()
    const gracePeriodDays = 7 // Default: 7 days grace period

    // Step 1: Find active subscriptions that have expired
    const expiredSubs = await prisma.subscription.findMany({
      where: {
        status: 'active',
        endDate: { lt: now }
      },
      include: {
        tenant: { select: { id: true, name: true, slug: true } },
        plan: { select: { name: true } }
      }
    })

    let expiredCount = 0
    let suspendedCount = 0
    const actions: string[] = []

    for (const sub of expiredSubs) {
      const endDate = new Date(sub.endDate!)
      const gracePeriodEnd = new Date(endDate)
      gracePeriodEnd.setDate(gracePeriodEnd.getDate() + gracePeriodDays)

      if (now > gracePeriodEnd) {
        // Past grace period — suspend tenant
        await prisma.subscription.update({
          where: { id: sub.id },
          data: { status: 'expired' }
        })
        await prisma.tenant.update({
          where: { id: sub.tenantId },
          data: { active: false }
        })
        suspendedCount++
        actions.push(`SUSPENDED: ${sub.tenant.name} (${sub.tenant.slug}) — plan "${sub.plan.name}" expired on ${endDate.toISOString()}`)
        logger.warn(`[BILLING-CHECK] Suspended tenant "${sub.tenant.name}" (${sub.tenant.slug}) — subscription expired`)
      } else {
        // Still in grace period — mark as expired but don't suspend
        await prisma.subscription.update({
          where: { id: sub.id },
          data: { status: 'expired' }
        })
        expiredCount++
        actions.push(`EXPIRED: ${sub.tenant.name} (${sub.tenant.slug}) — grace period until ${gracePeriodEnd.toISOString()}`)
        logger.info(`[BILLING-CHECK] Marked subscription expired for "${sub.tenant.name}" (grace: ${gracePeriodDays}d remaining)`)
      }
    }

    // Step 2: Find trial subscriptions that have passed their trialEndDate
    const expiredTrials = await prisma.subscription.findMany({
      where: {
        status: 'trial',
        trialEndDate: { lt: now }
      },
      include: {
        tenant: { select: { id: true, name: true, slug: true } }
      }
    })

    let trialExpiredCount = 0

    for (const sub of expiredTrials) {
      await prisma.subscription.update({
        where: { id: sub.id },
        data: { status: 'expired' }
      })
      trialExpiredCount++
      actions.push(`TRIAL_EXPIRED: ${sub.tenant.name} (${sub.tenant.slug})`)
      logger.info(`[BILLING-CHECK] Trial expired for "${sub.tenant.name}"`)
    }

    // Audit log
    try {
      await (prisma as any).adminAuditLog.create({
        data: {
          action: 'BILLING_CHECK',
          adminUserId: 'SYSTEM',
          adminUserName: 'CRON',
          details: JSON.stringify({
            expired: expiredCount,
            suspended: suspendedCount,
            trialExpired: trialExpiredCount,
            actions,
          }),
          ipAddress: 'cron',
        }
      })
    } catch { /* audit table may not exist */ }

    return NextResponse.json({
      success: true,
      timestamp: now.toISOString(),
      summary: {
        expired: expiredCount,
        suspended: suspendedCount,
        trialExpired: trialExpiredCount,
        total: expiredCount + suspendedCount + trialExpiredCount,
      },
      actions,
    })
  } catch (error: any) {
    logger.error('[BILLING-CHECK] Error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
