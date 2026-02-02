import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/api-middleware'
import { PERMISSIONS } from '@/lib/permissions'
import { withTenantTx } from '@/lib/tenancy'

export async function GET(request: Request) {
  const session = await requirePermission(request as any, PERMISSIONS.MANAGE_SALES)

  if (session instanceof NextResponse) {
    return session
  }

  const tenantId = (session.user as any).tenantId

  try {
    const categories = await withTenantTx(tenantId, async (prisma) => {
      // Get all unique categories from products (exclude RAW ingredients)
      const products = await prisma.product.findMany({
        where: {
          active: true,
          productType: { not: 'RAW' }
        },
        select: { category: true },
        distinct: ['category'],
      })

      return products
        .map((p: any) => p.category)
        .filter((cat: any): cat is string => cat !== null && cat !== undefined)
        .sort()
    })

    return NextResponse.json({ categories })
  } catch (error) {
    console.error('Error fetching categories:', error)
    return NextResponse.json(
      { error: 'Failed to fetch categories' },
      { status: 500 }
    )
  }
}

