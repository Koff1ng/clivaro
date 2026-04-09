import { NextResponse } from 'next/server'
import { logger } from '@/lib/logger'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { id: (session.user as any).id },
      select: { isSuperAdmin: true }
    })

    if (!user?.isSuperAdmin) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    // Fetch all stats in parallel
    const [tenants, plans, users] = await Promise.all([
      prisma.tenant.findMany({
        include: {
          subscriptions: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            include: { plan: true }
          }
        }
      }),
      prisma.plan.findMany(),
      prisma.user.count(),
    ])

    let ticketCounts = 0
    try {
      ticketCounts = await (prisma as any).supportTicket.count({ where: { status: { in: ['OPEN', 'IN_PROGRESS'] } } })
    } catch { /* table may not exist yet */ }

    const now = new Date()
    const activeTenants = tenants.filter(t => t.active)
    const inactiveTenants = tenants.filter(t => !t.active)
    
    // Subscription stats
    const activeSubscriptions = tenants.filter(t => {
      const sub = t.subscriptions?.[0]
      if (!sub) return false
      const end = sub.endDate ? new Date(sub.endDate) : null
      return (sub.status === 'active' || sub.status === 'trial') && (!end || end > now)
    })
    
    const trialSubscriptions = tenants.filter(t => {
      const sub = t.subscriptions?.[0]
      return sub?.status === 'trial'
    })

    const expiredSubscriptions = tenants.filter(t => {
      const sub = t.subscriptions?.[0]
      if (!sub) return false
      if (sub.status === 'expired' || sub.status === 'cancelled') return true
      const end = sub.endDate ? new Date(sub.endDate) : null
      return end && end < now
    })

    const suspendedTenants = tenants.filter(t => !t.active)

    // Revenue calculation (MRR & ARR)
    let mrr = 0
    const planDistribution: Record<string, number> = {}
    
    activeSubscriptions.forEach(t => {
      const sub = t.subscriptions[0]
      if (sub?.plan) {
        const monthlyPrice = sub.plan.interval === 'annual' 
          ? sub.plan.price / 12 
          : sub.plan.price
        mrr += monthlyPrice
        const planName = sub.plan.name
        planDistribution[planName] = (planDistribution[planName] || 0) + 1
      }
    })

    const arr = mrr * 12

    // Churn calculation (last 30 days)
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    
    const churned = tenants.filter(t => {
      const sub = t.subscriptions?.[0]
      if (!sub) return false
      if (sub.status === 'cancelled' && new Date(sub.updatedAt) > thirtyDaysAgo) return true
      return false
    })

    const totalAtStart = tenants.length - tenants.filter(t => new Date(t.createdAt) > thirtyDaysAgo).length
    const churnRate = totalAtStart > 0 ? (churned.length / totalAtStart) * 100 : 0

    // New registrations this month
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const newThisMonth = tenants.filter(t => new Date(t.createdAt) >= startOfMonth).length

    // Monthly costs (estimated)
    const costs = {
      supabase: 25,
      vercel: 20 + 5,
      factus: activeSubscriptions.length * 0.12,
      total: 0,
    }
    costs.total = costs.supabase + costs.vercel + costs.factus

    // Recent tenants (last 5)
    const recentTenants = [...tenants]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 5)
      .map(t => ({
        id: t.id,
        name: t.name,
        slug: t.slug,
        active: t.active,
        createdAt: t.createdAt,
        plan: t.subscriptions?.[0]?.plan?.name || 'Sin plan',
        status: t.subscriptions?.[0]?.status || 'none',
      }))

    // Tenants created per month (last 6 months)
    const sixMonthsAgo = new Date()
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)
    const monthlyGrowth: Record<string, number> = {}
    tenants
      .filter(t => new Date(t.createdAt) > sixMonthsAgo)
      .forEach(t => {
        const month = new Date(t.createdAt).toISOString().slice(0, 7)
        monthlyGrowth[month] = (monthlyGrowth[month] || 0) + 1
      })

    // Conversion rate (paid tenants / total tenants)
    const paidTenants = activeSubscriptions.filter(t => {
      const sub = t.subscriptions[0]
      return sub?.status === 'active' && sub?.plan?.price > 0
    })
    const conversionRate = tenants.length > 0 ? (paidTenants.length / tenants.length) * 100 : 0

    return NextResponse.json({
      overview: {
        totalTenants: tenants.length,
        activeTenants: activeTenants.length,
        inactiveTenants: inactiveTenants.length,
        suspendedTenants: suspendedTenants.length,
        totalUsers: users,
        activeSubscriptions: activeSubscriptions.length,
        trialSubscriptions: trialSubscriptions.length,
        expiredSubscriptions: expiredSubscriptions.length,
        newThisMonth,
        openTickets: ticketCounts,
      },
      revenue: {
        mrr,
        mrrUsd: Math.round(mrr / 4200),
        arr,
        arrUsd: Math.round(arr / 4200),
      },
      churn: {
        rate: Math.round(churnRate * 100) / 100,
        churned: churned.length,
        period: '30d',
      },
      conversion: {
        rate: Math.round(conversionRate * 100) / 100,
        paid: paidTenants.length,
        total: tenants.length,
      },
      costs,
      planDistribution,
      recentTenants,
      monthlyGrowth,
      plans: plans.map(p => ({ id: p.id, name: p.name, price: p.price })),
    })
  } catch (error: any) {
    logger.error('Admin stats error:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
