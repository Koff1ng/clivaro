import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/api-middleware'
import { PERMISSIONS } from '@/lib/permissions'
import { withTenantRead, getTenantIdFromSession } from '@/lib/tenancy'

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await requirePermission(request as any, PERMISSIONS.MANAGE_PURCHASES)
  if (session instanceof NextResponse) return session

  const tenantId = getTenantIdFromSession(session)

  try {
    const result = await withTenantRead(tenantId, async (prisma) => {
      const receipt = await prisma.goodsReceipt.findUnique({
        where: { id: params.id },
        include: {
          purchaseOrder: {
            include: {
              supplier: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  phone: true,
                  address: true,
                  taxId: true,
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
          },
          warehouse: {
            select: {
              id: true,
              name: true,
              address: true,
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
              variant: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
      })

      if (!receipt) return null

      // Try to get createdBy separately if relation exists
      let createdBy: { id: string, name: string } | null = null
      if (receipt.createdById) {
        try {
          createdBy = await prisma.user.findUnique({
            where: { id: receipt.createdById },
            select: { id: true, name: true },
          })
        } catch (err) {
          console.warn('Could not fetch createdBy user:', err)
        }
      }

      // Calculate total
      const total = receipt.items.reduce((sum, item) => sum + (item.quantity * item.unitCost), 0)

      return {
        ...receipt,
        createdBy,
        total,
      }
    })

    if (!result) {
      return NextResponse.json({ error: 'Receipt not found' }, { status: 404 })
    }

    return NextResponse.json(result)
  } catch (error: any) {
    console.error('Error fetching receipt:', error)
    return NextResponse.json(
      {
        error: 'Failed to fetch receipt',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      },
      { status: 500 }
    )
  }
}
