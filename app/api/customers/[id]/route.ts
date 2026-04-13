import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/api-middleware'
import { PERMISSIONS } from '@/lib/permissions'
import { withTenantRead, withTenantTx, getTenantIdFromSession } from '@/lib/tenancy'
import { logger } from '@/lib/logger'
import { z } from 'zod'

export const dynamic = 'force-dynamic'
import { safeErrorMessage } from '@/lib/safe-error'

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
  idType: z.string().optional(),
})

export async function GET(
  request: Request,
  { params }: { params: { id: string } | Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await Promise.resolve(params)
    const customerId = resolvedParams.id
    if (!customerId) return NextResponse.json({ error: 'Customer ID is required' }, { status: 400 })

    const session = await requirePermission(request as any, PERMISSIONS.MANAGE_CRM)
    if (session instanceof NextResponse) return session

    const tenantId = getTenantIdFromSession(session)

    const result = await withTenantRead(tenantId, async (prisma) => {
      const customer = await prisma.customer.findUnique({ where: { id: customerId } })
      if (!customer) return null

      // Get sales statistics
      const [invoicesResult, quotationsResult] = await Promise.all([
        prisma.invoice.findMany({
          where: { customerId },
          select: { id: true, number: true, status: true, total: true, createdAt: true, paidAt: true },
          orderBy: { createdAt: 'desc' },
          take: 10,
        }).catch(() => []),
        prisma.quotation.findMany({
          where: { customerId },
          select: { id: true, number: true, status: true, total: true, createdAt: true },
          orderBy: { createdAt: 'desc' },
          take: 10,
        }).catch(() => []),
      ])

      const [totalInvoices, totalSales] = await Promise.all([
        prisma.invoice.aggregate({
          where: { customerId, status: { in: ['PAGADA', 'PAID'] } },
          _sum: { total: true },
        }).catch(() => ({ _sum: { total: null } })),
        prisma.invoice.aggregate({
          where: { customerId, status: { in: ['PAGADA', 'PAID', 'EMITIDA', 'ISSUED'] } },
          _sum: { total: true },
        }).catch(() => ({ _sum: { total: null } })),
      ])

      return {
        customer,
        invoices: invoicesResult,
        quotations: quotationsResult,
        totalInvoices: totalInvoices?._sum?.total || 0,
        totalSales: totalSales?._sum?.total || 0,
      }
    })

    if (!result) return NextResponse.json({ error: 'Customer not found' }, { status: 404 })

    const { customer, invoices, quotations, totalInvoices, totalSales } = result

    // Process customer data safely
    const processedTags: string[] = customer.tags
      ? String(customer.tags).split(',').map((t) => t.trim()).filter(Boolean)
      : []

    const responseData = {
      customer: {
        ...customer,
        tags: processedTags,
        taxRegime: customer.taxRegime || null,
        idType: (customer as any).idType || null,
      },
      statistics: {
        totalSales: Number(totalSales),
        totalInvoices: Number(totalInvoices),
        ordersCount: 0,
        invoicesCount: invoices.length,
        quotationsCount: quotations.length,
      },
      recentOrders: [],
      recentInvoices: invoices,
      recentQuotations: quotations,
    }

    return NextResponse.json(responseData)
  } catch (error: any) {
    logger.error('Error fetching customer', error, { endpoint: '/api/customers/[id]', method: 'GET' })
    return NextResponse.json({ error: 'Failed to fetch customer', details: safeErrorMessage(error) }, { status: 500 })
  }
}

export async function PUT(
  request: Request,
  { params }: { params: { id: string } | Promise<{ id: string }> }
) {
  const resolvedParams = await Promise.resolve(params)
  const customerId = resolvedParams.id

  const session = await requirePermission(request as any, PERMISSIONS.MANAGE_CRM)
  if (session instanceof NextResponse) return session

  const tenantId = getTenantIdFromSession(session)
  const user = session.user as any

  try {
    const body = await request.json()
    const data = updateCustomerSchema.parse(body)

    const customer = await withTenantTx(tenantId, async (prisma) => {
      return await prisma.customer.update({
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
          idType: data.idType || null,
          updatedById: user.id,
        },
      })
    })

    return NextResponse.json(customer)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation error', details: error.errors }, { status: 400 })
    }
    logger.error('Error updating customer', error, { endpoint: '/api/customers/[id]', method: 'PUT', customerId })
    return NextResponse.json({ error: 'Failed to update customer' }, { status: 500 })
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } | Promise<{ id: string }> }
) {
  const resolvedParams = await Promise.resolve(params)
  const customerId = resolvedParams.id

  const session = await requirePermission(request as any, PERMISSIONS.MANAGE_CRM)
  if (session instanceof NextResponse) return session

  const tenantId = getTenantIdFromSession(session)

  try {
    await withTenantTx(tenantId, async (prisma) => {
      await prisma.customer.update({
        where: { id: customerId },
        data: { active: false },
      })
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    logger.error('Error deleting customer', error, { endpoint: '/api/customers/[id]', method: 'DELETE', customerId })
    return NextResponse.json({ error: 'Failed to delete customer' }, { status: 500 })
  }
}

