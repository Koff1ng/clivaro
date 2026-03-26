import { NextResponse } from 'next/server'
import { requireAnyPermission } from '@/lib/api-middleware'
import { PERMISSIONS } from '@/lib/permissions'
import { withTenantTx } from '@/lib/tenancy'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

function getPeriodDays(period: string): number {
  switch (period) {
    case 'today': return 1
    case 'week': return 7
    case 'month': return 30
    case 'year': return 365
    default: return 30
  }
}

export async function GET(request: Request) {
  const session = await requireAnyPermission(request as any, [PERMISSIONS.VIEW_REPORTS, PERMISSIONS.MANAGE_SALES])

  if (session instanceof NextResponse) {
    return session
  }

  const tenantId = (session.user as any).tenantId
  const isSuperAdmin = (session.user as any).isSuperAdmin

  const { searchParams } = new URL(request.url)
  const period = searchParams.get('period') || 'month'
  const numDays = getPeriodDays(period)

  // Super admins have no tenant data
  if (isSuperAdmin || !tenantId) {
    const emptyDays = Array.from({ length: numDays }, (_, i) => {
      const date = new Date()
      date.setDate(date.getDate() - (numDays - 1 - i))
      return { day: date.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' }), sales: 0, count: 0 }
    })
    return NextResponse.json(emptyDays)
  }

  try {
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - numDays)

    const invoices = await withTenantTx(tenantId, async (tx: any) => {
      return tx.invoice.findMany({
        where: {
          createdAt: { gte: startDate },
          status: { in: ['PAGADA', 'PAID', 'EN_COBRANZA', 'PARCIAL', 'PARTIAL'] },
        },
        select: { total: true, createdAt: true },
      })
    })

    // Group by day
    const salesByDay: Record<string, { sales: number, count: number }> = {}
    ;(invoices as any[]).forEach((invoice: any) => {
      const dateKey = invoice.createdAt.toISOString().split('T')[0]
      if (!salesByDay[dateKey]) salesByDay[dateKey] = { sales: 0, count: 0 }
      salesByDay[dateKey].sales += invoice.total
      salesByDay[dateKey].count += 1
    })

    // Generate array for the period
    const days = []
    for (let i = numDays - 1; i >= 0; i--) {
      const date = new Date()
      date.setDate(date.getDate() - i)
      const dateKey = date.toISOString().split('T')[0]
      const dayData = salesByDay[dateKey] || { sales: 0, count: 0 }

      // For year view, use month-based format
      const dayLabel = numDays > 60
        ? date.toLocaleDateString('es-ES', { month: 'short', year: '2-digit' })
        : date.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })

      days.push({
        day: dayLabel,
        sales: dayData.sales,
        count: dayData.count,
      })
    }

    // For year view, aggregate by month
    if (numDays > 60) {
      const monthMap: Record<string, { day: string, sales: number, count: number }> = {}
      for (const d of days) {
        if (!monthMap[d.day]) monthMap[d.day] = { day: d.day, sales: 0, count: 0 }
        monthMap[d.day].sales += d.sales
        monthMap[d.day].count += d.count
      }
      return NextResponse.json(Object.values(monthMap))
    }

    return NextResponse.json(days)
  } catch (error: any) {
    logger.error('Error fetching chart data', error, {
      endpoint: '/api/dashboard/last-30-days',
      method: 'GET',
      errorMessage: error?.message,
    })
    return NextResponse.json(
      { error: 'Failed to fetch chart data', details: error?.message || String(error) },
      { status: 500 }
    )
  }
}
