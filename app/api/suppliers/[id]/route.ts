import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/api-middleware'
import { PERMISSIONS } from '@/lib/permissions'
import { getPrismaForRequest } from '@/lib/get-tenant-prisma'
import { z } from 'zod'

const updateSupplierSchema = z.object({
  name: z.string().min(1).optional(),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  address: z.string().optional(),
  taxId: z.string().optional(),
  notes: z.string().optional(),
  active: z.boolean().optional(),
})

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await requirePermission(request as any, PERMISSIONS.MANAGE_PURCHASES)
    
    if (session instanceof NextResponse) {
      return session
    }

  // Obtener el cliente Prisma correcto (tenant o master según el usuario)
  const prisma = await getPrismaForRequest(request, session)

  const supplier = await prisma.supplier.findUnique({
      where: { id: params.id },
    })

    if (!supplier) {
      return NextResponse.json(
        { error: 'Supplier not found' },
        { status: 404 }
      )
    }

    // Get purchase orders first to get their IDs
    let purchaseOrders: any[] = []
    let purchaseOrderIds: string[] = []
    let allGoodsReceipts: any[] = []
    let receiptsTotal = 0
    let totalPurchases = { _sum: { total: null as number | null } }

    try {
      purchaseOrders = await prisma.purchaseOrder.findMany({
        where: { supplierId: params.id },
        select: {
          id: true,
          number: true,
          status: true,
          total: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
      })

      purchaseOrderIds = purchaseOrders.map(po => po.id)

      // Get goods receipts for these purchase orders
      if (purchaseOrderIds.length > 0) {
        allGoodsReceipts = await prisma.goodsReceipt.findMany({
          where: {
            purchaseOrderId: {
              in: purchaseOrderIds,
            },
          },
          include: {
            items: {
              select: {
                quantity: true,
                unitCost: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        })
      }

      // Calculate total for each goods receipt from items
      const goodsReceipts = allGoodsReceipts.map(gr => {
        const total = gr.items.reduce((sum: number, item: any) => sum + (item.quantity * item.unitCost), 0)
        return {
          id: gr.id,
          number: gr.number,
          total: total,
          createdAt: gr.createdAt,
        }
      }).slice(0, 10) // Limit to 10 most recent

      // Get recent orders (limit to 10)
      const recentOrders = purchaseOrders.slice(0, 10)

      // Calculate totals
      totalPurchases = await prisma.purchaseOrder.aggregate({
        where: {
          supplierId: params.id,
          status: 'RECEIVED',
        },
        _sum: {
          total: true,
        },
      })

      // Calculate total receipts amount from all goods receipts
      receiptsTotal = allGoodsReceipts.reduce((sum, gr) => {
        const grTotal = gr.items.reduce((itemSum: number, item: any) => itemSum + (item.quantity * item.unitCost), 0)
        return sum + grTotal
      }, 0)

      return NextResponse.json({
        supplier,
        statistics: {
          totalPurchases: totalPurchases._sum.total || 0,
          totalReceipts: receiptsTotal,
          ordersCount: purchaseOrders.length,
          receiptsCount: allGoodsReceipts.length,
        },
        recentOrders: recentOrders,
        recentReceipts: goodsReceipts,
      })
    } catch (queryError: any) {
      console.error('Error in purchase orders/receipts query:', queryError)
      // Return supplier data even if statistics fail
      return NextResponse.json({
        supplier,
        statistics: {
          totalPurchases: 0,
          totalReceipts: 0,
          ordersCount: 0,
          receiptsCount: 0,
        },
        recentOrders: [],
        recentReceipts: [],
      })
    }
  } catch (error: any) {
    console.error('Error fetching supplier:', error)
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      name: error.name,
      code: error.code,
    })
    
    // Return more specific error messages
    let errorMessage = 'Failed to fetch supplier'
    if (error.message) {
      errorMessage = error.message
    } else if (error.code === 'P2002') {
      errorMessage = 'Duplicate entry error'
    } else if (error.code === 'P2025') {
      errorMessage = 'Supplier not found'
    }
    
    return NextResponse.json(
      { 
        error: errorMessage,
        message: error.message || 'Unknown error occurred',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      },
      { status: 500 }
    )
  }
}

export async function PUT(
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
    const body = await request.json()
    const data = updateSupplierSchema.parse(body)

    const supplier = await prisma.supplier.update({
      where: { id: params.id },
      data: {
        ...data,
        email: data.email !== undefined ? (data.email || null) : undefined,
        phone: data.phone !== undefined ? (data.phone || null) : undefined,
        address: data.address !== undefined ? (data.address || null) : undefined,
        taxId: data.taxId !== undefined ? (data.taxId || null) : undefined,
        notes: data.notes !== undefined ? (data.notes || null) : undefined,
        updatedById: (session.user as any).id,
      },
    })

    return NextResponse.json(supplier)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      )
    }
    console.error('Error updating supplier:', error)
    return NextResponse.json(
      { error: 'Failed to update supplier' },
      { status: 500 }
    )
  }
}

export async function DELETE(
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
    await prisma.supplier.update({
      where: { id: params.id },
      data: { active: false },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting supplier:', error)
    return NextResponse.json(
      { error: 'Failed to delete supplier' },
      { status: 500 }
    )
  }
}

