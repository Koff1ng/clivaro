import { NextResponse } from 'next/server'
import { requireAnyPermission } from '@/lib/api-middleware'
import { PERMISSIONS } from '@/lib/permissions'
import { withTenantRead, getTenantIdFromSession } from '@/lib/tenancy'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const session = await requireAnyPermission(request as any, [PERMISSIONS.VIEW_REPORTS, PERMISSIONS.MANAGE_CRM])
  if (session instanceof NextResponse) return session

  const tenantId = getTenantIdFromSession(session)
  if (!tenantId) {
    return NextResponse.json({ activities: [], total: 0 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const customerId = searchParams.get('customerId') || undefined
    const rawLimit = parseInt(searchParams.get('limit') || '30')
    const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, 50) : 30

    const result = await withTenantRead(tenantId, async (prisma) => {
      const [invoices, products, payments] = await Promise.all([
        prisma.invoice.findMany({
          take: limit,
          include: { customer: { select: { id: true, name: true } }, createdBy: { select: { id: true, name: true } } },
          where: customerId ? { customerId } : undefined,
          orderBy: { createdAt: 'desc' },
        }),
        prisma.product.findMany({
          take: limit,
          where: { active: true },
          orderBy: { createdAt: 'desc' },
        }),
        prisma.payment.findMany({
          take: limit,
          select: {
            id: true,
            amount: true,
            method: true,
            createdAt: true,
            invoice: { select: { id: true, number: true, customer: { select: { id: true, name: true } } } }
          },
          where: customerId ? { invoice: { customerId } } : undefined,
          orderBy: { createdAt: 'desc' },
        }),
      ])

      const activities: any[] = []

      invoices.forEach((inv: any) => {
        activities.push({
          id: `invoice-${inv.id}`,
          type: 'INVOICE',
          title: `Factura creada: ${inv.number}`,
          description: `Cliente: ${inv.customer?.name || 'N/A'}`,
          details: { number: inv.number, customer: inv.customer?.name, total: inv.total, status: inv.status },
          user: inv.createdBy?.name || 'Sistema',
          createdAt: inv.createdAt,
          icon: 'file-text',
          color: 'blue',
        })
      })

      products.forEach((p: any) => {
        activities.push({
          id: `product-${p.id}`,
          type: 'PRODUCT',
          title: `Producto nuevo: ${p.name}`,
          description: `SKU: ${p.sku || 'N/A'} - Precio: $${Number(p.price || 0).toFixed(2)}`,
          details: { name: p.name, sku: p.sku, price: p.price },
          user: 'Sistema',
          createdAt: p.createdAt,
          icon: 'package',
          color: 'blue',
        })
      })

      payments.forEach((p: any) => {
        activities.push({
          id: `payment-${p.id}`,
          type: 'PAYMENT',
          title: `Pago recibido: $${Number(p.amount || 0).toFixed(2)}`,
          description: `Factura: ${p.invoice?.number || 'N/A'}`,
          details: { amount: p.amount, method: p.method, customer: p.invoice?.customer?.name },
          user: 'Sistema',
          createdAt: p.createdAt,
          icon: 'dollar-sign',
          color: 'green',
        })
      })

      activities.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

      return {
        activities: activities.slice(0, limit),
        total: activities.length
      }
    })

    return NextResponse.json(result)
  } catch (error: any) {
    logger.error('Error fetching activity feed', error, { endpoint: '/api/activity-feed' })
    return NextResponse.json({ activities: [], total: 0 })
  }
}
