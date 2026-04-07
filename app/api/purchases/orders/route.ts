import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/api-middleware'
import { PERMISSIONS } from '@/lib/permissions'
import { withTenantRead, withTenantTx } from '@/lib/tenancy'
import { z } from 'zod'
import { parseDateOnlyToDate } from '@/lib/date-only'
import { toDecimal } from '@/lib/numbers'
import { logActivity } from '@/lib/activity'

export const dynamic = 'force-dynamic'

const createPurchaseOrderSchema = z.object({
  supplierId: z.string().min(1, "El proveedor es requerido"),
  items: z.array(z.object({
    productId: z.string().min(1, "El ID del producto es requerido"),
    variantId: z.string().optional().nullable(),
    quantity: z.number().min(0.01, "La cantidad debe ser mayor a 0"),
    unitCost: z.number().min(0, "El costo unitario no puede ser negativo"),
    taxRate: z.number().min(0).max(100).default(0),
  })).min(1, "La orden debe tener al menos un ítem"),
  discount: z.number().min(0).default(0),
  expectedDate: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
})

type CreatePurchaseOrderInput = z.infer<typeof createPurchaseOrderSchema>

export async function GET(request: Request) {
  const session = await requirePermission(request as any, PERMISSIONS.MANAGE_PURCHASES)

  if (session instanceof NextResponse) {
    return session
  }

  const tenantId = (session.user as any).tenantId

  try {
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const search = searchParams.get('search') || ''
    const status = searchParams.get('status')
    const supplierId = searchParams.get('supplierId')
    const skip = (page - 1) * limit

    const result = await withTenantRead(tenantId, async (prisma) => {
      const where: any = {}

      if (search) {
        where.OR = [
          { number: { contains: search, mode: 'insensitive' } },
          { supplier: { name: { contains: search, mode: 'insensitive' } } },
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
            _count: {
              select: { items: true }
            }
          },
          orderBy: { createdAt: 'desc' },
        }),
        prisma.purchaseOrder.count({ where }),
      ])

      return {
        orders,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      }
    })

    return NextResponse.json(result)
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

  const tenantId = (session.user as any).tenantId

  try {
    const body = await request.json()
    const parseResult = createPurchaseOrderSchema.safeParse(body)

    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Error de validación', details: parseResult.error.flatten() },
        { status: 400 }
      )
    }

    const data: CreatePurchaseOrderInput = parseResult.data

    const order = await withTenantTx(tenantId, async (prisma) => {
      // Calculate totals
      let subtotalRaw = 0
      const itemsData: any[] = []

      for (const item of data.items) {
        const itemSubtotal = toDecimal(item.quantity) * toDecimal(item.unitCost)
        const itemTax = itemSubtotal * (toDecimal(item.taxRate) / 100)
        const itemTotal = itemSubtotal + itemTax

        subtotalRaw += itemSubtotal
        itemsData.push({
          productId: item.productId,
          variantId: item.variantId || null,
          quantity: toDecimal(item.quantity),
          unitCost: toDecimal(item.unitCost),
          taxRate: toDecimal(item.taxRate),
          subtotal: itemTotal,
        })
      }

      const discount = toDecimal(data.discount)
      const subtotalAfterDiscount = subtotalRaw - discount
      const totalTax = itemsData.reduce((sum: number, item: any) => sum + (item.quantity * item.unitCost * item.taxRate / 100), 0)
      const total = subtotalAfterDiscount + totalTax

      // Generate order number
      const orderCount = await prisma.purchaseOrder.count()
      const orderNumber = `PO-${String(orderCount + 1).padStart(6, '0')}`

      const createdOrder = await prisma.purchaseOrder.create({
        data: {
          number: orderNumber,
          supplierId: data.supplierId,
          status: 'DRAFT',
          subtotal: subtotalAfterDiscount,
          discount,
          tax: totalTax,
          total,
          expectedDate: parseDateOnlyToDate(data.expectedDate),
          notes: data.notes || null,
          createdById: (session.user as any).id,
          items: {
            create: itemsData,
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

      // Audit Log
      await logActivity({
        prisma,
        type: 'PURCHASE_ORDER_CREATE',
        subject: `Orden de Compra creada: ${orderNumber}`,
        userId: (session.user as any).id,
        metadata: { orderId: createdOrder.id, orderNumber }
      })

      return createdOrder
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
      { 
        error: 'Failed to create purchase order', 
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    )
  }
}
