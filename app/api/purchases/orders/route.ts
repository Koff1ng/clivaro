import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/api-middleware'
import { PERMISSIONS } from '@/lib/permissions'
import { getPrismaForRequest } from '@/lib/get-tenant-prisma'
import { z } from 'zod'
import { parseDateOnlyToDate } from '@/lib/date-only'
import { toDecimal } from '@/lib/numbers'

const createPurchaseOrderSchema = z.object({
  supplierId: z.string().min(1),
  items: z.array(z.object({
    productId: z.string(),
    variantId: z.string().optional().nullable(),
    quantity: z.number().min(0.01),
    unitCost: z.number().min(0),
    taxRate: z.number().min(0).max(100).default(0),
  })),
  discount: z.number().min(0).default(0),
  expectedDate: z.string().optional().nullable(),
  notes: z.string().optional(),
})

export async function GET(request: Request) {
  const session = await requirePermission(request as any, PERMISSIONS.MANAGE_PURCHASES)
  
  if (session instanceof NextResponse) {
    return session
  }

  // Obtener el cliente Prisma correcto (tenant o master según el usuario)
  const prisma = await getPrismaForRequest(request, session)

  try {
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const search = searchParams.get('search') || ''
    const status = searchParams.get('status')
    const supplierId = searchParams.get('supplierId')
    const skip = (page - 1) * limit

    const where: any = {}

    if (search) {
      where.OR = [
        { number: { contains: search } },
        { supplier: { name: { contains: search } } },
      ]
    }

    if (status) {
      where.status = status
    }

    if (supplierId) {
      where.supplierId = supplierId
    }

    const [orders, total] = await Promise.all([
      prisma.purchaseOrder.findMany({
        where,
        skip,
        take: limit,
        include: {
          supplier: {
            select: {
              id: true,
              name: true,
              email: true,
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
        orderBy: { createdAt: 'desc' },
      }),
      prisma.purchaseOrder.count({ where }),
    ])

    return NextResponse.json({
      orders,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error('Error fetching purchase orders:', error)
    return NextResponse.json(
      { error: 'Failed to fetch purchase orders' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  const session = await requirePermission(request as any, PERMISSIONS.MANAGE_PURCHASES)
  
  if (session instanceof NextResponse) {
    return session
  }

  // Obtener el cliente Prisma correcto (tenant o master según el usuario)
  const prisma = await getPrismaForRequest(request, session)

  try {
    const body = await request.json()
    const data = createPurchaseOrderSchema.parse(body)

    // Calculate totals
    let subtotal = 0
    const items = []

    for (const item of data.items) {
      const itemSubtotal = toDecimal(item.quantity) * toDecimal(item.unitCost)
      const itemTax = itemSubtotal * (toDecimal(item.taxRate) / 100)
      const itemTotal = itemSubtotal + itemTax

      subtotal += itemSubtotal
      items.push({
        productId: item.productId,
        variantId: item.variantId || null,
        quantity: toDecimal(item.quantity),
        unitCost: toDecimal(item.unitCost),
        taxRate: toDecimal(item.taxRate),
        subtotal: itemTotal,
      })
    }

    const discount = toDecimal(data.discount)
    const subtotalAfterDiscount = subtotal - discount
    const tax = items.reduce((sum, item) => {
      const itemSubtotal = item.quantity * item.unitCost
      return sum + (itemSubtotal * item.taxRate / 100)
    }, 0)
    const total = subtotalAfterDiscount + tax

    // Generate order number
    const orderCount = await prisma.purchaseOrder.count()
    const orderNumber = `PO-${String(orderCount + 1).padStart(6, '0')}`

    const order = await prisma.purchaseOrder.create({
      data: {
        number: orderNumber,
        supplierId: data.supplierId,
        status: 'DRAFT',
        subtotal: subtotalAfterDiscount,
        discount,
        tax,
        total,
        expectedDate: parseDateOnlyToDate(data.expectedDate),
        notes: data.notes || null,
        createdById: (session.user as any).id,
        items: {
          create: items,
        },
      },
      include: {
        supplier: true,
        items: {
          include: {
            product: true,
          },
        },
      },
    })

    return NextResponse.json(order, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      )
    }
    console.error('Error creating purchase order:', error)
    return NextResponse.json(
      { error: 'Failed to create purchase order' },
      { status: 500 }
    )
  }
}

