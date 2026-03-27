import { NextResponse } from 'next/server'
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

    const now = new Date()
    const activeTenants = tenants.filter(t => t.active)
    const inactiveTenants = tenants.filter(t => !t.active)
    
    // Subscription stats
    const activeSubscriptions = tenants.filter(t => {
      const sub = t.subscriptions?.[0]
      if (!sub) return false
      const end = sub.endDate ? new Date(sub.endDate) : null
      return sub.status === 'active' && (!end || end > now)
    })
    
    const trialSubscriptions = tenants.filter(t => {
      const sub = t.subscriptions?.[0]
      return sub?.status === 'trial'
    })

    const expiredSubscriptions = tenants.filter(t => {
      const sub = t.subscriptions?.[0]
      if (!sub || sub.status !== 'active') return false
      const end = sub.endDate ? new Date(sub.endDate) : null
      return end && end < now
    })

    // Revenue calculation (MRR)
    let mrr = 0
    const planDistribution: Record<string, number> = {}
    
    activeSubscriptions.forEach(t => {
      const sub = t.subscriptions[0]
      if (sub?.plan) {
        mrr += sub.plan.price
        const planName = sub.plan.name
        planDistribution[planName] = (planDistribution[planName] || 0) + 1
      }
    })

    // Monthly costs (estimated)
    const costs = {
      supabase: 25, // USD - Pro plan
      vercel: 20 + 5, // USD - Pro + IPv4
      factus: activeSubscriptions.length * 0.12, // USD approx per invoice
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
        const month = new Date(t.createdAt).toISOString().slice(0, 7) // YYYY-MM
        monthlyGrowth[month] = (monthlyGrowth[month] || 0) + 1
      })

    return NextResponse.json({
      overview: {
        totalTenants: tenants.length,
        activeTenants: activeTenants.length,
        inactiveTenants: inactiveTenants.length,
        totalUsers: users,
        activeSubscriptions: activeSubscriptions.length,
        trialSubscriptions: trialSubscriptions.length,
        expiredSubscriptions: expiredSubscriptions.length,
      },
      revenue: {
        mrr, // COP
        mrrUsd: Math.round(mrr / 4200), // Approx USD
      },
      costs,
      planDistribution,
      recentTenants,
      monthlyGrowth,
      plans: plans.map(p => ({ id: p.id, name: p.name, price: p.price })),
    })
  } catch (error: any) {
    console.error('Admin stats error:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
