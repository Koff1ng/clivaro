import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/api-middleware'
import { PERMISSIONS } from '@/lib/permissions'
import { withTenantRead } from '@/lib/tenancy'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const session = await requirePermission(request as any, PERMISSIONS.MANAGE_SALES)

  if (session instanceof NextResponse) {
    return session
  }

  const tenantId = (session.user as any).tenantId

  try {
    const result = await withTenantRead(tenantId, async (prisma) => {
      // Get all unique categories from products (exclude RAW ingredients)
      const products = await prisma.product.findMany({
        where: {
          active: true,
          productType: { not: 'RAW' }
        },
        select: { category: true },
        distinct: ['category'],
      })

      const categories = products
        .map((p: any) => p.category)
        .filter((cat: any): cat is string => cat !== null && cat !== undefined)
        .sort()

      return { categories }
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error('Error fetching categories:', error)
    return NextResponse.json(
      { error: 'Failed to fetch categories' },
      { status: 500 }
    )
  }
}
