import { NextResponse } from 'next/server'
import { requirePermission, requireAnyPermission } from '@/lib/api-middleware'
import { PERMISSIONS } from '@/lib/permissions'
import { getPrismaForRequest } from '@/lib/get-tenant-prisma'

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await requireAnyPermission(request as any, [PERMISSIONS.MANAGE_CASH, PERMISSIONS.MANAGE_SALES])
  
  if (session instanceof NextResponse) {
    return session
  }

  // Obtener el cliente Prisma correcto (tenant o master según el usuario)
  const prisma = await getPrismaForRequest(request, session)

  try {
    // Get shift
    const shift = await prisma.cashShift.findUnique({
      where: { id: params.id },
    })

    if (!shift) {
      return NextResponse.json(
        { error: 'Cash shift not found' },
        { status: 404 }
      )
    }

    // Get all invoices created during this shift
    const invoices = await prisma.invoice.findMany({
      where: {
        createdAt: {
          gte: shift.openedAt,
          lte: shift.closedAt || new Date(),
        },
        createdById: shift.userId,
        // excluir anuladas del resumen operativo
        status: { notIn: ['ANULADA', 'VOID'] as any },
      },
      select: {
        id: true,
        number: true,
        subtotal: true,
        discount: true,
        tax: true,
        total: true,
        payments: {
          select: {
            id: true,
            amount: true,
            method: true,
            createdAt: true,
          },
        },
        items: {
          select: {
            quantity: true,
            unitPrice: true,
            discount: true,
            product: {
              select: {
                cost: true,
              },
            },
          },
        },
      },
    })

    // Extract all payments with invoice number
    const payments = invoices.flatMap(invoice => 
      invoice.payments.map(payment => ({
        id: payment.id,
        amount: payment.amount,
        method: payment.method,
        createdAt: payment.createdAt,
        invoiceNumber: invoice.number,
      }))
    )

    // Calculate totals by payment method
    const totalsByMethod = payments.reduce((acc: any, payment: any) => {
      const method = payment.method
      if (!acc[method]) {
        acc[method] = 0
      }
      acc[method] += payment.amount
      return acc
    }, {})

    // Discounts summary (line discounts + invoice-level discount)
    const discountsByInvoice = invoices.map((inv: any) => {
      const lineDiscount = (inv.items || []).reduce((sum: number, it: any) => {
        const gross = Number(it.quantity || 0) * Number(it.unitPrice || 0)
        const discPct = Number(it.discount || 0)
        return sum + (gross * discPct / 100)
      }, 0)
      const headerDiscount = Number(inv.discount || 0)
      const discountTotal = lineDiscount + headerDiscount
      return {
        invoiceNumber: inv.number,
        discountTotal,
      }
    }).filter((d: any) => d.discountTotal > 0)

    const totalDiscounts = discountsByInvoice.reduce((sum: number, d: any) => sum + d.discountTotal, 0)

    // Calcular ganancias del turno: (ingresos sin impuestos - descuentos - costos)
    const profit = invoices.reduce((sum: number, inv: any) => {
      // Subtotal sin impuestos = subtotal - descuento de factura
      const invoiceSubtotal = typeof inv.subtotal === 'number' ? inv.subtotal : 0
      const invoiceDiscount = typeof inv.discount === 'number' ? inv.discount : 0
      const subtotalWithoutTaxes = invoiceSubtotal > 0 
        ? invoiceSubtotal - invoiceDiscount 
        : (inv.total || 0) - (inv.tax || 0) - invoiceDiscount
      
      // Costo de productos vendidos en esta factura
      const invoiceCost = (inv.items || []).reduce((itemSum: number, item: any) => {
        const productCost = item.product?.cost || 0
        return itemSum + (Number(item.quantity || 0) * productCost)
      }, 0)
      
      return sum + (subtotalWithoutTaxes - invoiceCost)
    }, 0)

    return NextResponse.json({
      payments,
      totalsByMethod,
      total: payments.reduce((sum: number, p: any) => sum + p.amount, 0),
      discounts: {
        total: totalDiscounts,
        byInvoice: discountsByInvoice.sort((a: any, b: any) => b.discountTotal - a.discountTotal).slice(0, 20),
      },
      profit, // Ganancia del turno
    })
  } catch (error) {
    console.error('Error fetching shift payments:', error)
    return NextResponse.json(
      { error: 'Failed to fetch payments' },
      { status: 500 }
    )
  }
}

