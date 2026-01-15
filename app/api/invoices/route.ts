import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/api-middleware'
import { PERMISSIONS } from '@/lib/permissions'
import { getPrismaForRequest } from '@/lib/get-tenant-prisma'

export async function GET(request: Request) {
  const session = await requirePermission(request as any, PERMISSIONS.MANAGE_SALES)
  
  if (session instanceof NextResponse) {
    return session
  }

  // Obtener el cliente Prisma correcto (tenant o master según el usuario)
  const prisma = await getPrismaForRequest(request, session)

  try {
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const search = searchParams.get('search') || ''
    const status = searchParams.get('status')
    const customerId = searchParams.get('customerId')
    const skip = (page - 1) * limit

    const where: any = {}

    if (search) {
      where.OR = [
        { number: { contains: search } },
        { cufe: { contains: search } },
        { customer: { name: { contains: search } } },
      ]
    }

    if (status) {
      // Mapear estados antiguos a nuevos para compatibilidad
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

    return NextResponse.json({
      invoices,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error('Error fetching invoices:', error)
    return NextResponse.json(
      { error: 'Failed to fetch invoices' },
      { status: 500 }
    )
  }
}

