import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/api-middleware'
import { PERMISSIONS } from '@/lib/permissions'
import { withTenantRead, getTenantIdFromSession } from '@/lib/tenancy'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const session = await requirePermission(request as any, PERMISSIONS.MANAGE_SALES)
  if (session instanceof NextResponse) return session

  const tenantId = getTenantIdFromSession(session)
  const { searchParams } = new URL(request.url)
  const page = parseInt(searchParams.get('page') || '1')
  const limit = parseInt(searchParams.get('limit') || '50')
  const statusFilter = searchParams.get('status') || 'ALL'
  const skip = (page - 1) * limit

  try {
    const result = await withTenantRead(tenantId, async (prisma) => {
      // Build where clause
      const where: any = {}

      if (statusFilter === 'SENT') {
        where.electronicStatus = { in: ['SENT', 'ACCEPTED'] }
      } else if (statusFilter === 'PENDING') {
        where.OR = [
          { electronicStatus: null },
          { electronicStatus: 'PENDING' },
        ]
      } else if (statusFilter === 'REJECTED') {
        where.electronicStatus = 'REJECTED'
      }
      // ALL = no filter

      const [invoices, total, stats] = await Promise.all([
        prisma.invoice.findMany({
          where,
          skip,
          take: limit,
          select: {
            id: true,
            number: true,
            total: true,
            status: true,
            electronicStatus: true,
            cufe: true,
            qrCode: true,
            electronicResponse: true,
            electronicSentAt: true,
            createdAt: true,
            issuedAt: true,
            customer: {
              select: {
                name: true,
                taxId: true,
                email: true,
              }
            },
          },
          orderBy: { createdAt: 'desc' },
        }),
        prisma.invoice.count({ where }),
        // Aggregate stats
        Promise.all([
          prisma.invoice.count({ where: { electronicStatus: { in: ['SENT', 'ACCEPTED'] } } }),
          prisma.invoice.count({ where: { electronicStatus: 'REJECTED' } }),
          prisma.invoice.count({ where: { OR: [{ electronicStatus: null }, { electronicStatus: 'PENDING' }] } }),
          prisma.invoice.count(),
        ]),
      ])

      return {
        invoices,
        total,
        stats: {
          sent: stats[0],
          rejected: stats[1],
          pending: stats[2],
          totalInvoices: stats[3],
        }
      }
    })

    return NextResponse.json({
      invoices: result.invoices,
      stats: result.stats,
      pagination: {
        page,
        limit,
        total: result.total,
        totalPages: Math.ceil(result.total / limit),
      }
    })
  } catch (error: any) {
    logger.error('[Electronic Invoicing API Error]:', error)
    return NextResponse.json(
      { error: error.message || 'Error al cargar facturas electrónicas' },
      { status: 500 }
    )
  }
}
