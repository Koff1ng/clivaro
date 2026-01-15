import { NextResponse } from 'next/server'
import { requireAnyPermission } from '@/lib/api-middleware'
import { PERMISSIONS } from '@/lib/permissions'
import { getPrismaForRequest } from '@/lib/get-tenant-prisma'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const session = await requireAnyPermission(request as any, [PERMISSIONS.VIEW_REPORTS, PERMISSIONS.MANAGE_SALES])
  
  if (session instanceof NextResponse) {
    return session
  }

  const prisma = await getPrismaForRequest(request, session)

  try {
    // Obtener top clientes por total de facturas
    const topClients = await prisma.customer.findMany({
      include: {
        invoices: {
          select: {
            total: true,
            status: true,
          },
        },
      },
      take: 10,
    })

    const clientsWithTotal = topClients
      .map(customer => ({
        id: customer.id,
        name: customer.name,
        total: customer.invoices
          .filter(inv => inv.status === 'PAGADA' || inv.status === 'PAID') // Compatibilidad con estados antiguos y nuevos
          .reduce((sum, inv) => sum + inv.total, 0),
      }))
      .filter(c => c.total > 0)
      .sort((a, b) => b.total - a.total)
      .slice(0, 5)

    return NextResponse.json(clientsWithTotal)
  } catch (error: any) {
    logger.error('Error fetching top clients', error, { endpoint: '/api/dashboard/top-clients', method: 'GET' })
    return NextResponse.json(
      { error: 'Failed to fetch top clients', details: error?.message || String(error) },
      { status: 500 }
    )
  }
}

