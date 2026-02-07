import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/api-middleware'
import { PERMISSIONS } from '@/lib/permissions'
import { withTenantTx, getTenantIdFromSession } from '@/lib/tenancy'

export async function GET(request: Request) {
  const session = await requirePermission(request as any, PERMISSIONS.MANAGE_USERS)

  if (session instanceof NextResponse) {
    return session
  }

  const tenantId = getTenantIdFromSession(session)

  try {
    const roles = await withTenantTx(tenantId, async (tx) => {
      return await tx.role.findMany({
        include: {
          rolePermissions: {
            include: {
              permission: {
                select: {
                  id: true,
                  name: true,
                  description: true,
                },
              },
            },
          },
        },
        orderBy: { name: 'asc' },
      })
    })

    return NextResponse.json({ roles })
  } catch (error) {
    console.error('Error fetching roles:', error)
    return NextResponse.json(
      { error: 'Failed to fetch roles' },
      { status: 500 }
    )
  }
}

