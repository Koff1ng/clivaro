/**
 * GET /api/restaurant/menu
 * Restaurant-specific product catalog endpoint.
 * Supports both:
 *  - Regular NextAuth session (cashier/admin)
 *  - Waiter token (x-tenant-id + x-waiter-token headers)
 * Returns products grouped with category for commander use.
 */
import { NextResponse } from 'next/server'
import { requireAnyPermission } from '@/lib/api-middleware'
import { PERMISSIONS } from '@/lib/permissions'
import { getTenantPrismaClient, getTenantIdFromSession } from '@/lib/tenancy'
import { ensureRestaurantMode, getWaiterFromToken } from '@/lib/restaurant'

export const dynamic = 'force-dynamic'

async function resolveContext(req: Request) {
  const tenantIdHeader = req.headers.get('x-tenant-id')
  const waiterToken = req.headers.get('x-waiter-token')

  if (tenantIdHeader && waiterToken) {
    const waiter = await getWaiterFromToken(waiterToken, tenantIdHeader)
    if (!waiter) return { error: NextResponse.json({ error: 'Invalid waiter token' }, { status: 401 }) }
    return { tenantId: tenantIdHeader }
  }

  const session = await requireAnyPermission(req as any, [
    PERMISSIONS.MANAGE_SALES,
    PERMISSIONS.MANAGE_RESTAURANT,
    PERMISSIONS.MANAGE_CASH,
  ])
  if (session instanceof NextResponse) return { error: session }

  return { tenantId: getTenantIdFromSession(session) }
}

export async function GET(request: Request) {
  try {
    const ctx = await resolveContext(request)
    if ('error' in ctx) return ctx.error

    const restaurantCheck = await ensureRestaurantMode(ctx.tenantId)
    if (restaurantCheck) return restaurantCheck

    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search') || ''
    const category = searchParams.get('category') || ''
    const limit = Math.min(parseInt(searchParams.get('limit') || '200'), 500)

    const prisma = await getTenantPrismaClient(ctx.tenantId)

    const where: any = {
      active: true,
      productType: { in: ['PREPARED', 'RETAIL', 'SELLABLE'] },
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { sku: { contains: search, mode: 'insensitive' } },
      ]
    }

    if (category) {
      where.category = category
    }

    const productsRaw = await prisma.product.findMany({
      where,
      take: limit,
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
      select: {
        id: true,
        name: true,
        sku: true,
        price: true,
        taxRate: true,
        category: true,
        description: true,
        printerStation: true,
        productType: true,
      },
    })

    const products = productsRaw.map((p: any) => ({
      id: p.id,
      name: p.name,
      sku: p.sku,
      price: p.price,
      taxRate: p.taxRate,
      category: p.category || 'Sin categoría',
      description: p.description || '',
      printerStation: p.printerStation || 'KITCHEN',
    }))

    // Distinct sorted categories
    const categorySet = new Set<string>()
    products.forEach((p) => categorySet.add(p.category))
    const categories = Array.from(categorySet).sort()

    return NextResponse.json({ products, categories, total: products.length })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Error loading menu' }, { status: 500 })
  }
}
