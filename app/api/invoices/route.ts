import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/api-middleware'
import { PERMISSIONS } from '@/lib/permissions'
import { withTenantRead } from '@/lib/tenancy'

export async function GET(request: Request) {
  const session = await requirePermission(request as any, PERMISSIONS.MANAGE_SALES)

  if (session instanceof NextResponse) {
    return session
  }

  const tenantId = (session.user as any).tenantId

  try {
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const search = searchParams.get('search') || ''
    const status = searchParams.get('status')
    const electronicStatus = searchParams.get('electronicStatus')
    const customerId = searchParams.get('customerId')
    const skip = (page - 1) * limit

    const result = await withTenantRead(tenantId, async (prisma) => {
      const where: any = {}

      if (search) {
        where.OR = [
          { number: { contains: search, mode: 'insensitive' } },
          { cufe: { contains: search, mode: 'insensitive' } },
          { customer: { name: { contains: search, mode: 'insensitive' } } },
        ]
      }

      if (status) {
        const statusMap: Record<string, string> = {
          'ISSUED': 'EMITIDA',
          'PAID': 'PAGADA',
          'VOID': 'ANULADA',
          'PARTIAL': 'EN_COBRANZA',
          'PARCIAL': 'EN_COBRANZA',
        }
        where.status = statusMap[status] || status
      }

      if (customerId) {
        where.customerId = customerId
      }

      if (electronicStatus) {
        if (electronicStatus === 'SENT') {
          where.electronicStatus = { in: ['SENT', 'ACCEPTED'] }
        } else if (electronicStatus === 'PENDING') {
          where.OR = [
            ...(where.OR || []),
            { electronicStatus: null },
            { electronicStatus: 'PENDING' },
          ]
        } else if (electronicStatus === 'REJECTED') {
          where.electronicStatus = 'REJECTED'
        }
      }

      const [invoices, total] = await Promise.all([
        prisma.invoice.findMany({
          where,
          skip,
          take: limit,
          include: {
            customer: {
              select: {
                id: true,
                name: true,
                email: true,
                taxId: true,
              },
            },
            salesOrder: {
              select: {
                id: true,
                number: true,
              },
            },
            payments: {
              select: {
                amount: true,
                method: true,
              },
            },
            items: {
              include: {
                product: {
                  select: {
                    id: true,
                    name: true,
                    sku: true,
                  },
                },
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        }),
        prisma.invoice.count({ where }),
      ])

      return {
        invoices,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      }
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error('Error fetching invoices:', error)
    return NextResponse.json(
      { error: 'Failed to fetch invoices' },
      { status: 500 }
    )
  }
}

