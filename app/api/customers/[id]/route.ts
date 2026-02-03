import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/api-middleware'
import { PERMISSIONS } from '@/lib/permissions'
import { getPrismaForRequest } from '@/lib/get-tenant-prisma'
import { logger } from '@/lib/logger'
import { z } from 'zod'

const updateCustomerSchema = z.object({
  name: z.string().min(1),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  address: z.string().optional(),
  taxId: z.string().optional(),
  tags: z.array(z.string()).optional(),
  notes: z.string().optional(),
  active: z.boolean().optional(),
  isCompany: z.boolean().optional(),
  taxRegime: z.string().optional(),
})

export async function GET(
  request: Request,
  { params }: { params: { id: string } | Promise<{ id: string }> }
) {
  try {
    // Handle params as Promise (Next.js 15+)
    const resolvedParams = typeof params === 'object' && 'then' in params
      ? await params
      : params as { id: string }
    const customerId = resolvedParams.id

    if (!customerId) {
      return NextResponse.json(
        { error: 'Customer ID is required' },
        { status: 400 }
      )
    }

    const session = await requirePermission(request as any, PERMISSIONS.MANAGE_CRM)

    if (session instanceof NextResponse) {
      return session
    }

    // Obtener el cliente Prisma correcto (tenant o master según el usuario)
    const prisma = await getPrismaForRequest(request, session)

    let customer
    try {
      customer = await prisma.customer.findUnique({
        where: { id: customerId },
      })
    } catch (dbError: any) {
      logger.error('Database error fetching customer', dbError, { customerId })
      throw dbError
    }

    if (!customer) {
      return NextResponse.json(
        { error: 'Customer not found' },
        { status: 404 }
      )
    }

    // Get sales statistics (only invoices and quotations, no sales orders)
    let invoices: any[] = []
    let quotations: any[] = []
    let totalInvoices: any = { _sum: { total: null } }

    let totalSales: any = { _sum: { total: null } }

    try {
      const [invoicesResult, quotationsResult] = await Promise.all([
        prisma.invoice.findMany({
          where: { customerId: customerId },
          select: {
            id: true,
            number: true,
            status: true,
            total: true,
            createdAt: true,
            paidAt: true,
          },
          orderBy: { createdAt: 'desc' },
          take: 10,
        }).catch((err) => {
          logger.warn('Error fetching invoices (non-critical)', { customerId, err })
          return []
        }),
        prisma.quotation.findMany({
          where: { customerId: customerId },
          select: {
            id: true,
            number: true,
            status: true,
            total: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
          take: 10,
        }).catch((err) => {
          logger.warn('Error fetching quotations (non-critical)', { customerId, err })
          return []
        }),
      ])

      invoices = invoicesResult || []
      quotations = quotationsResult || []

      // Calculate totals
      try {
        const [totalInvoicesResult, totalSalesResult] = await Promise.all([
          prisma.invoice.aggregate({
            where: {
              customerId: customerId,
              status: { in: ['PAGADA', 'PAID'] }, // Compatibilidad con estados antiguos y nuevos
            },
            _sum: {
              total: true,
            },
          }).catch((err) => {
            logger.warn('Error aggregating paid invoices (non-critical)', { customerId, err })
            return { _sum: { total: null } }
          }),
          prisma.invoice.aggregate({
            where: {
              customerId: customerId,
              status: { in: ['PAGADA', 'PAID', 'EMITIDA', 'ISSUED'] }, // Compatibilidad con estados antiguos y nuevos
            },
            _sum: {
              total: true,
            },
          }).catch((err) => {
            logger.warn('Error aggregating all invoices (non-critical)', { customerId, err })
            return { _sum: { total: null } }
          }),
        ])

        totalInvoices = totalInvoicesResult || { _sum: { total: null } }
        totalSales = totalSalesResult || { _sum: { total: null } }
      } catch (aggError: any) {
        logger.warn('Error in aggregate queries (non-critical)', { customerId, aggError })
        // Continue with default values
      }
    } catch (dbError: any) {
      logger.warn('Database error fetching statistics (non-critical)', { customerId, dbError })
      // Continue with empty arrays and default totals
    }

    try {
      // Process customer data safely
      if (!customer) {
        throw new Error('Customer data is null or undefined')
      }

      // Safely process tags (schema: tags String?)
      const processedTags: string[] = customer.tags
        ? String(customer.tags).split(',').map((t) => t.trim()).filter(Boolean)
        : []

      // Create a safe copy of customer data with proper date serialization
      const processedCustomer = {
        id: String(customer.id),
        name: String(customer.name || ''),
        phone: customer.phone ? String(customer.phone) : null,
        email: customer.email ? String(customer.email) : null,
        address: customer.address ? String(customer.address) : null,
        taxId: customer.taxId ? String(customer.taxId) : null,
        tags: processedTags,
        notes: customer.notes ? String(customer.notes) : null,
        active: Boolean(customer.active ?? true),
        isCompany: !!customer.isCompany,
        taxRegime: customer.taxRegime || null,
        createdAt: customer.createdAt instanceof Date
          ? customer.createdAt.toISOString()
          : (customer.createdAt ? new Date(customer.createdAt).toISOString() : null),
        updatedAt: customer.updatedAt instanceof Date
          ? customer.updatedAt.toISOString()
          : (customer.updatedAt ? new Date(customer.updatedAt).toISOString() : null),
        createdById: customer.createdById ? String(customer.createdById) : null,
        updatedById: customer.updatedById ? String(customer.updatedById) : null,
      }

      // Safely get totals
      const totalSalesValue = (totalSales?._sum?.total != null) ? Number(totalSales._sum.total) : 0
      const totalInvoicesValue = (totalInvoices?._sum?.total != null) ? Number(totalInvoices._sum.total) : 0

      // Safely serialize invoices and quotations
      const serializedInvoices = (invoices || []).map((inv: any) => ({
        id: String(inv.id || ''),
        number: String(inv.number || ''),
        status: String(inv.status || ''),
        total: Number(inv.total || 0),
        createdAt: inv.createdAt instanceof Date
          ? inv.createdAt.toISOString()
          : (inv.createdAt ? new Date(inv.createdAt).toISOString() : null),
        paidAt: inv.paidAt instanceof Date
          ? inv.paidAt.toISOString()
          : (inv.paidAt ? new Date(inv.paidAt).toISOString() : null),
      }))

      const serializedQuotations = (quotations || []).map((quot: any) => ({
        id: String(quot.id || ''),
        number: String(quot.number || ''),
        status: String(quot.status || ''),
        total: Number(quot.total || 0),
        createdAt: quot.createdAt instanceof Date
          ? quot.createdAt.toISOString()
          : (quot.createdAt ? new Date(quot.createdAt).toISOString() : null),
      }))

      const responseData = {
        customer: processedCustomer,
        statistics: {
          totalSales: totalSalesValue,
          totalInvoices: totalInvoicesValue,
          ordersCount: 0, // No hay órdenes de venta
          invoicesCount: serializedInvoices.length,
          quotationsCount: serializedQuotations.length,
        },
        recentOrders: [], // No hay órdenes de venta
        recentInvoices: serializedInvoices,
        recentQuotations: serializedQuotations,
      }
      return NextResponse.json(responseData)
    } catch (processError: any) {
      logger.error('Error processing customer data', processError, { customerId })
      throw processError
    }
  } catch (error: any) {
    logger.error('Error fetching customer', error, { endpoint: '/api/customers/[id]', method: 'GET' })

    return NextResponse.json(
      {
        error: 'Failed to fetch customer',
        details: process.env.NODE_ENV === 'development' ? error?.message : undefined
      },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: Request,
  { params }: { params: { id: string } | Promise<{ id: string }> }
) {
  // Handle params as Promise (Next.js 15+)
  const resolvedParams = await Promise.resolve(params)
  const customerId = resolvedParams.id

  const session = await requirePermission(request as any, PERMISSIONS.MANAGE_CRM)

  if (session instanceof NextResponse) {
    return session
  }

  // Obtener el cliente Prisma correcto (tenant o master según el usuario)
  const prisma = await getPrismaForRequest(request, session)

  try {
    const body = await request.json()
    const data = updateCustomerSchema.parse(body)

    const customer = await prisma.customer.update({
      where: { id: customerId },
      data: {
        ...data,
        email: data.email || null,
        phone: data.phone || null,
        address: data.address || null,
        taxId: data.taxId || null,
        tags: data.tags ? data.tags.join(',') : null,
        notes: data.notes || null,
        isCompany: data.isCompany !== undefined ? data.isCompany : undefined,
        taxRegime: data.taxRegime || null,
        updatedById: (session.user as any).id,
      },
    })

    return NextResponse.json(customer)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      )
    }
    logger.error('Error updating customer', error, { endpoint: '/api/customers/[id]', method: 'PUT', customerId })
    return NextResponse.json(
      { error: 'Failed to update customer' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } | Promise<{ id: string }> }
) {
  // Handle params as Promise (Next.js 15+)
  const resolvedParams = await Promise.resolve(params)
  const customerId = resolvedParams.id

  const session = await requirePermission(request as any, PERMISSIONS.MANAGE_CRM)

  if (session instanceof NextResponse) {
    return session
  }

  // Obtener el cliente Prisma correcto (tenant o master según el usuario)
  const prisma = await getPrismaForRequest(request, session)

  try {
    await prisma.customer.update({
      where: { id: customerId },
      data: { active: false },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    logger.error('Error deleting customer', error, { endpoint: '/api/customers/[id]', method: 'DELETE', customerId })
    return NextResponse.json(
      { error: 'Failed to delete customer' },
      { status: 500 }
    )
  }
}

