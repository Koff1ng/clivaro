import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/api-middleware'
import { PERMISSIONS } from '@/lib/permissions'
import { getPrismaForRequest } from '@/lib/get-tenant-prisma'

export async function GET(request: Request) {
  const session = await requirePermission(request as any, PERMISSIONS.MANAGE_INVENTORY)

  if (session instanceof NextResponse) {
    return session
  }

  // Obtener el cliente Prisma correcto (tenant o master según el usuario)
  const prisma = await getPrismaForRequest(request, session)

  try {
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const warehouseId = searchParams.get('warehouseId')
    const type = searchParams.get('type')
    const createdById = searchParams.get('createdById')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const q = (searchParams.get('q') || '').trim()
    const skip = (page - 1) * limit

    const where: any = {}

    if (warehouseId) {
      where.warehouseId = warehouseId
    }

    if (type) {
      where.type = type
    }

    if (createdById) {
      where.createdById = createdById
    }

    if (startDate || endDate) {
      where.createdAt = {}
      if (startDate) {
        where.createdAt.gte = new Date(startDate)
      }
      if (endDate) {
        where.createdAt.lte = new Date(endDate)
      }
    }

    if (q) {
      where.OR = [
        { reason: { contains: q, mode: 'insensitive' } },
        { reference: { contains: q, mode: 'insensitive' } },
        {
          product: {
            is: {
              OR: [
                { name: { contains: q, mode: 'insensitive' } },
                { sku: { contains: q, mode: 'insensitive' } },
              ],
            },
          },
        },
      ]
    }

    const [movements, total] = await Promise.all([
      prisma.stockMovement.findMany({
        where,
        skip,
        take: limit,
        include: {
          product: {
            select: {
              id: true,
              name: true,
              sku: true,
            },
          },
          warehouse: {
            select: {
              id: true,
              name: true,
            },
          },
          createdBy: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.stockMovement.count({ where }),
    ])

    const result = movements.map(m => ({
      id: m.id,
      warehouseName: m.warehouse.name,
      productName: m.product?.name || 'Unknown',
      productSku: m.product?.sku || '',
      type: m.type,
      quantity: m.quantity,
      cost: m.cost,
      reference: m.reference,
      reason: m.reason,
      createdAt: m.createdAt,
      createdByName: m.createdBy.name,
    }))

    return NextResponse.json({
      movements: result,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error('Error fetching movements:', error)
    return NextResponse.json(
      { error: 'Failed to fetch movements' },
      { status: 500 }
    )
  }
}

