import { NextResponse } from 'next/server'
import { requireAnyPermission } from '@/lib/api-middleware'
import { PERMISSIONS } from '@/lib/permissions'
import { withTenantRead } from '@/lib/tenancy'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const session = await requireAnyPermission(request as any, [PERMISSIONS.VIEW_REPORTS, PERMISSIONS.MANAGE_SALES])

  if (session instanceof NextResponse) {
    return session
  }

  const tenantId = (session.user as any).tenantId
  if (!tenantId) {
    return NextResponse.json([], { status: 403 })
  }

  try {
    const result = await withTenantRead(tenantId, async (prisma) => {
      const topClients = await prisma.customer.findMany({
        include: {
          invoices: {
            where: { status: { in: ['PAGADA', 'PAID'] } },
            select: { total: true },
          },
        },
        take: 10,
      })

      return topClients
        .map((customer: any) => ({
          id: customer.id,
          name: customer.name,
          total: customer.invoices.reduce((sum: number, inv: any) => sum + inv.total, 0),
        }))
        .filter((c: any) => c.total > 0)
        .sort((a: any, b: any) => b.total - a.total)
        .slice(0, 5)
    })

    return NextResponse.json(result)
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
