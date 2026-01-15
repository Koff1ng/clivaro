import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/api-middleware'
import { PERMISSIONS } from '@/lib/permissions'
import { getPrismaForRequest } from '@/lib/get-tenant-prisma'

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await requirePermission(request as any, PERMISSIONS.MANAGE_PURCHASES)
  
  if (session instanceof NextResponse) {
    return session
  }

  // Obtener el cliente Prisma correcto (tenant o master según el usuario)
  const prisma = await getPrismaForRequest(request, session)

  try {
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

    if (!receipt) {
      return NextResponse.json(
        { error: 'Receipt not found' },
        { status: 404 }
      )
    }

    // Try to get createdBy separately if relation exists
    let createdBy = null
    if (receipt.createdById) {
      try {
        const user = await prisma.user.findUnique({
          where: { id: receipt.createdById },
          select: {
            id: true,
            name: true,
          },
        })
        createdBy = user
      } catch (err) {
        // Relation might not be available yet, ignore
        console.warn('Could not fetch createdBy user:', err)
      }
    }

    // Calculate total
    const total = receipt.items.reduce((sum, item) => sum + (item.quantity * item.unitCost), 0)

    return NextResponse.json({
      ...receipt,
      createdBy,
      total,
    })
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

