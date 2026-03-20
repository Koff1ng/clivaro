import { NextResponse } from 'next/server'
import { requireAnyPermission } from '@/lib/api-middleware'
import { PERMISSIONS } from '@/lib/permissions'
import { withTenantRead } from '@/lib/tenancy'

export async function GET(request: Request) {
  const session = await requireAnyPermission(request as any, [
    PERMISSIONS.MANAGE_SALES,
    PERMISSIONS.MANAGE_CASH,
  ])
  if (session instanceof NextResponse) return session

  const tenantId = (session.user as any).tenantId
  const { searchParams } = new URL(request.url)
  const search = searchParams.get('search') || ''

  try {
    const customers = await withTenantRead(tenantId, async (prisma) => {
      const where: any = { active: true }
      if (search) {
        where.OR = [
          { name: { contains: search, mode: 'insensitive' } },
          { taxId: { contains: search, mode: 'insensitive' } },
          { phone: { contains: search, mode: 'insensitive' } },
        ]
      }
      return prisma.customer.findMany({
        where,
        take: 15,
        orderBy: { name: 'asc' },
        select: { id: true, name: true, taxId: true, phone: true, email: true },
      })
    })

    return NextResponse.json(customers)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
