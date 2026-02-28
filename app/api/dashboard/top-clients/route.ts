import { NextResponse } from 'next/server'
import { requireAnyPermission } from '@/lib/api-middleware'
import { PERMISSIONS } from '@/lib/permissions'
import { withTenantTx } from '@/lib/tenancy'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const session = await requireAnyPermission(request as any, [PERMISSIONS.VIEW_REPORTS, PERMISSIONS.MANAGE_SALES])

  if (session instanceof NextResponse) {
    return session
  }

  const tenantId = (session.user as any).tenantId
  const isSuperAdmin = (session.user as any).isSuperAdmin

  if (isSuperAdmin || !tenantId) {
    return NextResponse.json([])
  }

  try {
    const topClients = await withTenantTx(tenantId, async (tx: any) => {
      return tx.customer.findMany({
        include: {
          invoices: {
            select: { total: true, status: true },
          },
        },
        take: 10,
      })
    })

    const clientsWithTotal = (topClients as any[])
      .map((customer: any) => ({
        id: customer.id,
        name: customer.name,
        total: customer.invoices
          .filter((inv: any) => inv.status === 'PAGADA' || inv.status === 'PAID')
          .reduce((sum: number, inv: any) => sum + inv.total, 0),
      }))
      .filter((c: any) => c.total > 0)
      .sort((a: any, b: any) => b.total - a.total)
      .slice(0, 5)

    return NextResponse.json(clientsWithTotal)
  } catch (error: any) {
    logger.error('Error fetching top clients', error, {
      endpoint: '/api/dashboard/top-clients',
      method: 'GET',
    })
    return NextResponse.json(
      { error: 'Failed to fetch top clients', details: error?.message || String(error) },
      { status: 500 }
    )
  }
}
