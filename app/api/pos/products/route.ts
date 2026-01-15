import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/api-middleware'
import { PERMISSIONS } from '@/lib/permissions'
import { getPrismaForRequest } from '@/lib/get-tenant-prisma'
import { logger } from '@/lib/logger'

export async function GET(request: Request) {
  const session = await requirePermission(request as any, PERMISSIONS.MANAGE_SALES)
  
  if (session instanceof NextResponse) {
    return session
  }

  // Obtener el cliente Prisma correcto (tenant o master según el usuario)
  const prisma = await getPrismaForRequest(request, session)

  try {
    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search') || ''
    const category = searchParams.get('category') || ''
    const limit = parseInt(searchParams.get('limit') || '100')

    const where: any = {
      active: true,
    }

    if (search) {
      where.OR = [
        { name: { contains: search } },
        { sku: { contains: search } },
        { barcode: { contains: search } },
      ]
    }

    if (category) {
      where.category = category
    }

    const products = await prisma.product.findMany({
      where,
      take: limit,
      orderBy: { name: 'asc' },
      include: {
        stockLevels: {
          select: {
            warehouseId: true,
            quantity: true,
          },
        },
      },
    })

    return NextResponse.json({
      products: products.map(p => ({
        id: p.id,
        name: p.name,
        sku: p.sku,
        barcode: p.barcode,
        price: p.price,
        taxRate: p.taxRate,
        trackStock: p.trackStock,
        stockLevels: p.stockLevels,
      })),
    })
  } catch (error: any) {
    logger.error('Error fetching POS products', error, { endpoint: '/api/pos/products', method: 'GET' })
    return NextResponse.json(
      { 
        error: error?.message || 'Failed to fetch products',
        code: 'SERVER_ERROR',
        details: process.env.NODE_ENV === 'development' ? String(error?.stack || '') : undefined,
      },
      { status: 500 }
    )
  }
}

