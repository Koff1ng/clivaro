import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/api-middleware'
import { PERMISSIONS } from '@/lib/permissions'
import { getPrismaForRequest } from '@/lib/get-tenant-prisma'
import { requirePlanFeature } from '@/lib/plan-middleware'
import { z } from 'zod'
import { toDecimal } from '@/lib/numbers'
import { parseDateOnlyToDate } from '@/lib/date-only'

const createQuotationSchema = z.object({
  customerId: z.string().optional(),
  customerName: z.string().optional(),
  customerEmail: z.string().email().optional().or(z.literal('')),
  customerPhone: z.string().optional(),
  customerTaxId: z.string().optional(),
  leadId: z.string().optional(),
  items: z.array(z.object({
    productId: z.string(),
    variantId: z.string().optional().nullable(),
    quantity: z.number().positive(),
    unitPrice: z.number().min(0),
    discount: z.number().min(0).max(100).default(0),
    taxRate: z.number().min(0).max(100),
  })),
  discount: z.number().min(0).default(0),
  validUntil: z.string().optional(),
  notes: z.string().optional(),
}).refine((data) => data.customerId || data.customerName, {
  message: 'Either customerId or customerName is required',
})

export async function GET(request: Request) {
  const session = await requirePermission(request as any, PERMISSIONS.MANAGE_SALES)
  
  if (session instanceof NextResponse) {
    return session
  }

  const user = session.user as any

  // Verificar feature del plan
  const planCheck = await requirePlanFeature(user.tenantId, 'quotations', user.isSuperAdmin)
  if (planCheck) {
    return planCheck
  }

  // Obtener el cliente Prisma correcto (tenant o master según el usuario)
  const prisma = await getPrismaForRequest(request, session)

  try {
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const search = searchParams.get('search') || ''
    const status = searchParams.get('status')
    const customerId = searchParams.get('customerId')
    const leadId = searchParams.get('leadId')
    const skip = (page - 1) * limit

    const where: any = {}

    if (search) {
      where.OR = [
        { number: { contains: search, mode: 'insensitive' } },
        { customer: { name: { contains: search, mode: 'insensitive' } } },
      ]
    }

    if (status) {
      where.status = status
    }

    if (customerId) {
      where.customerId = customerId
    }

    if (leadId) {
      where.leadId = leadId
    }

    const [quotations, total] = await Promise.all([
      prisma.quotation.findMany({
        where,
        skip,
        take: limit,
        include: {
          customer: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          lead: {
            select: {
              id: true,
              name: true,
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
      prisma.quotation.count({ where }),
    ])

    return NextResponse.json({
      quotations,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error('Error fetching quotations:', error)
    return NextResponse.json(
      { error: 'Failed to fetch quotations' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  const session = await requirePermission(request as any, PERMISSIONS.MANAGE_SALES)
  
  if (session instanceof NextResponse) {
    return session
  }

  const user = session.user as any

  // Verificar feature del plan
  const planCheck = await requirePlanFeature(user.tenantId, 'quotations', user.isSuperAdmin)
  if (planCheck) {
    return planCheck
  }

  // Obtener el cliente Prisma correcto (tenant o master según el usuario)
  const prisma = await getPrismaForRequest(request, session)

  try {
    const body = await request.json()
    const data = createQuotationSchema.parse(body)

    // Calculate totals
    let subtotal = 0
    const items = []

    for (const item of data.items) {
      const itemSubtotal = toDecimal(item.quantity) * toDecimal(item.unitPrice) * (1 - toDecimal(item.discount) / 100)
      const itemTax = itemSubtotal * (toDecimal(item.taxRate) / 100)
      const itemTotal = itemSubtotal + itemTax

      subtotal += itemSubtotal
      items.push({
        productId: item.productId,
        variantId: item.variantId || null,
        quantity: toDecimal(item.quantity),
        unitPrice: toDecimal(item.unitPrice),
        discount: toDecimal(item.discount),
        taxRate: toDecimal(item.taxRate),
        subtotal: itemTotal,
      })
    }

    const discount = toDecimal(data.discount)
    const subtotalAfterDiscount = subtotal - discount
    const tax = items.reduce((sum, item) => {
      const itemSubtotal = item.quantity * item.unitPrice * (1 - item.discount / 100)
      return sum + (itemSubtotal * item.taxRate / 100)
    }, 0)
    const total = subtotalAfterDiscount + tax

    // Handle customer - create if not exists
    let customerId = data.customerId
    if (!customerId && data.customerName) {
      // Create new customer on the fly
      const newCustomer = await prisma.customer.create({
        data: {
          name: data.customerName,
          email: data.customerEmail || null,
          phone: data.customerPhone || null,
          taxId: data.customerTaxId || null,
          createdById: (session.user as any).id,
        },
      })
      customerId = newCustomer.id
    }

    if (!customerId) {
      return NextResponse.json(
        { error: 'Customer ID or customer name is required' },
        { status: 400 }
      )
    }

    // Generate quotation number
    const quotationCount = await prisma.quotation.count()
    const quotationNumber = `QT-${String(quotationCount + 1).padStart(6, '0')}`

    const quotation = await prisma.quotation.create({
      data: {
        number: quotationNumber,
        customerId: customerId,
        leadId: data.leadId || null,
        status: 'DRAFT',
        subtotal: subtotalAfterDiscount,
        discount: discount,
        tax: tax,
        total: total,
        validUntil: parseDateOnlyToDate(data.validUntil),
        notes: data.notes || null,
        createdById: (session.user as any).id,
        items: {
          create: items,
        },
      },
      include: {
        customer: true,
        lead: true,
        items: {
          include: {
            product: true,
          },
        },
      },
    })

    return NextResponse.json(quotation, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      )
    }
    console.error('Error creating quotation:', error)
    return NextResponse.json(
      { error: 'Failed to create quotation' },
      { status: 500 }
    )
  }
}

