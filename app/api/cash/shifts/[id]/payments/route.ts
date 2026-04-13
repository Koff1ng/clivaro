import { NextResponse } from 'next/server'
import { requireAnyPermission } from '@/lib/api-middleware'
import { PERMISSIONS } from '@/lib/permissions'
import { withTenantRead, getTenantIdFromSession } from '@/lib/tenancy'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'
import { safeErrorMessage } from '@/lib/safe-error'

export async function GET(
  request: Request,
  { params }: { params: { id: string } | Promise<{ id: string }> }
) {
  const session = await requireAnyPermission(request as any, [PERMISSIONS.MANAGE_CASH, PERMISSIONS.MANAGE_SALES])
  if (session instanceof NextResponse) return session

  const tenantId = getTenantIdFromSession(session)

  try {
    const resolvedParams = await params

    const result = await withTenantRead(tenantId, async (prisma) => {
      const shift = await prisma.cashShift.findUnique({ where: { id: resolvedParams.id } })
      if (!shift) throw new Error('Cash shift not found')

      const invoices = await prisma.invoice.findMany({
        where: {
          createdAt: { gte: shift.openedAt, lte: shift.closedAt || new Date() },
          createdById: shift.userId,
          status: { notIn: ['ANULADA', 'VOID'] as any },
        },
        select: {
          id: true, number: true, subtotal: true, discount: true, tax: true, total: true,
          payments: { select: { id: true, amount: true, method: true, createdAt: true } },
          items: { select: { quantity: true, unitPrice: true, discount: true, product: { select: { cost: true } } } },
        },
      })

      return { shift, invoices }
    })

    const { invoices } = result

    const payments = (invoices as any[]).flatMap((invoice: any) =>
      invoice.payments.map((payment: any) => ({
        id: payment.id,
        amount: payment.amount,
        method: payment.method,
        createdAt: payment.createdAt,
        invoiceNumber: invoice.number,
      }))
    )

    const totalsByMethod = payments.reduce((acc: any, payment: any) => {
      acc[payment.method] = (acc[payment.method] || 0) + payment.amount
      return acc
    }, {})

    const discountsByInvoice = invoices.map((inv: any) => {
      const lineDiscount = (inv.items || []).reduce((sum: number, it: any) => {
        return sum + (Number(it.quantity || 0) * Number(it.unitPrice || 0) * Number(it.discount || 0) / 100)
      }, 0)
      return { invoiceNumber: inv.number, discountTotal: lineDiscount + Number(inv.discount || 0) }
    }).filter((d: any) => d.discountTotal > 0)

    const totalDiscounts = discountsByInvoice.reduce((sum: number, d: any) => sum + d.discountTotal, 0)

    const profit = invoices.reduce((sum: number, inv: any) => {
      const subtotalWithoutTaxes = (inv.subtotal || (inv.total - inv.tax)) - (inv.discount || 0)
      const invoiceCost = (inv.items || []).reduce((itemSum: number, item: any) => {
        return itemSum + (Number(item.quantity || 0) * (item.product?.cost || 0))
      }, 0)
      return sum + (subtotalWithoutTaxes - invoiceCost)
    }, 0)

    return NextResponse.json({
      payments,
      totalsByMethod,
      total: payments.reduce((sum: number, p: any) => sum + p.amount, 0),
      discounts: { total: totalDiscounts, byInvoice: discountsByInvoice.sort((a, b) => b.discountTotal - a.discountTotal).slice(0, 20) },
      profit,
    })
  } catch (error: any) {
    logger.error('Error fetching shift payments', error)
    return NextResponse.json({ error: safeErrorMessage(error, 'Failed to fetch payments') }, { status: 500 })
  }
}

