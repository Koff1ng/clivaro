import { NextResponse } from 'next/server'
import { requireAnyPermission } from '@/lib/api-middleware'
import { PERMISSIONS } from '@/lib/permissions'
import { getPrismaForRequest } from '@/lib/get-tenant-prisma'

// Minimal users list for filters (inventory/cash/reports)
export async function GET(request: Request) {
  const session = await requireAnyPermission(request as any, [
    PERMISSIONS.MANAGE_INVENTORY,
    PERMISSIONS.MANAGE_CASH,
    PERMISSIONS.VIEW_REPORTS,
    PERMISSIONS.MANAGE_SALES,
  ])

  if (session instanceof NextResponse) return session

  const prisma = await getPrismaForRequest(request, session)

  try {
    const { searchParams } = new URL(request.url)
    const q = (searchParams.get('q') || '').trim()

    const users = await prisma.user.findMany({
      where: {
        active: true,
        ...(q
          ? {
              OR: [
                { name: { contains: q } },
                { username: { contains: q } },
                { email: { contains: q } },
              ],
            }
          : {}),
      },
      select: {
        id: true,
        name: true,
        username: true,
        email: true,
      },
      orderBy: { name: 'asc' },
      take: 100,
    })

    return NextResponse.json({ users })
  } catch (error) {
    console.error('Error fetching users:', error)
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 })
  }
}


