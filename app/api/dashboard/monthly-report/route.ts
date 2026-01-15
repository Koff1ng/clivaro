import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/api-middleware'
import { PERMISSIONS } from '@/lib/permissions'
import { getPrismaForRequest } from '@/lib/get-tenant-prisma'
import { startOfMonth, endOfMonth, eachDayOfInterval, format, setHours, setMinutes, setSeconds, setMilliseconds } from 'date-fns'

export async function GET(request: Request) {
  const session = await requirePermission(request as any, PERMISSIONS.VIEW_REPORTS)
  
  if (session instanceof NextResponse) {
    return session
  }

  // Obtener el cliente Prisma correcto (tenant o master según el usuario)
  const prisma = await getPrismaForRequest(request, session)

  try {
    const { searchParams } = new URL(request.url)
    const year = parseInt(searchParams.get('year') || String(new Date().getFullYear()))
    const month = parseInt(searchParams.get('month') || String(new Date().getMonth() + 1))

    const monthStart = new Date(year, month - 1, 1)
    const monthEnd = endOfMonth(monthStart)

    // Ventas del mes
    const invoices = await prisma.invoice.findMany({
      where: {
        status: { in: ['PAGADA', 'PAID'] }, // Compatibilidad con estados antiguos y nuevos
        issuedAt: {
          gte: monthStart,
          lte: monthEnd,
        },
      },
      include: {
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                cost: true,
                price: true,
              },
            },
          },
        },
        payments: {
          select: {
            method: true,
            amount: true,
          },
        },
      },
    })

    // Calcular totales
    const totalSales = invoices.reduce((sum, inv) => sum + (inv.total || 0), 0)

    // Calcular impuestos totales
    const totalTaxes = invoices.reduce((sum, inv) => sum + (inv.tax || 0), 0)

    // Calcular costos de productos vendidos (basado en el costo de cada producto vendido)
    const costOfGoodsSold = invoices.reduce((sum, inv) => {
      const invoiceCost = inv.items.reduce((itemSum, item) => {
        const productCost = item.product?.cost || 0
        return itemSum + (item.quantity * productCost)
      }, 0)
      return sum + invoiceCost
    }, 0)

    // Subtotal sin impuestos (preferir subtotal real si existe, fallback a total - impuestos)
    const subtotalWithoutTaxes = invoices.reduce((sum, inv) => {
      const sub = (inv as any).subtotal
      if (typeof sub === 'number') return sum + sub
      return sum + ((inv.total || 0) - (inv.tax || 0))
    }, 0)

    // Ganancia = (precio_venta_sin_impuestos - costo) por ítem, agregada al mes
    // Es decir: subtotal_sin_impuestos - costo_de_mercancía_vendida
    const grossProfit = subtotalWithoutTaxes - costOfGoodsSold

    // Ganancia neta (por ahora igual a ganancia bruta; no incluye gastos operativos)
    const totalProfit = grossProfit

    const profitMargin = subtotalWithoutTaxes > 0 ? (grossProfit / subtotalWithoutTaxes) * 100 : 0

    // Ventas por día
    const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd })
    const salesByDay = daysInMonth.map(day => {
      const dayStart = setMilliseconds(setSeconds(setMinutes(setHours(new Date(day), 0), 0), 0), 0)
      const dayEnd = setMilliseconds(setSeconds(setMinutes(setHours(new Date(day), 23), 59), 59), 999)
      
      const dayInvoices = invoices.filter(inv => {
        const invDate = inv.issuedAt || inv.createdAt
        return invDate >= dayStart && invDate <= dayEnd
      })
      
      const daySales = dayInvoices.reduce((sum, inv) => sum + (inv.total || 0), 0)
      
      return {
        date: format(day, 'yyyy-MM-dd'),
        day: format(day, 'dd'),
        sales: daySales,
      }
    })

    // Ventas por método de pago
    const salesByPaymentMethod = invoices.reduce((acc, inv) => {
      inv.payments.forEach(payment => {
        const method = payment.method
        if (!acc[method]) {
          acc[method] = 0
        }
        acc[method] += payment.amount
      })
      return acc
    }, {} as Record<string, number>)

    // Top productos vendidos
    const productSales = invoices.reduce((acc, inv) => {
      inv.items.forEach(item => {
        const productId = item.productId
        const productName = item.product?.name || 'Producto desconocido'
        if (!acc[productId]) {
          acc[productId] = {
            id: productId,
            name: productName,
            quantity: 0,
            revenue: 0,
            cost: 0,
          }
        }
        acc[productId].quantity += item.quantity
        acc[productId].revenue += item.subtotal
        acc[productId].cost += (item.product?.cost || 0) * item.quantity
      })
      return acc
    }, {} as Record<string, any>)

    const topProducts = Object.values(productSales)
      .sort((a: any, b: any) => b.revenue - a.revenue)
      .slice(0, 10)
      .map((p: any) => ({
        ...p,
        profit: p.revenue - p.cost,
      }))

    // Estadísticas adicionales
    const totalInvoices = invoices.length
    const averageInvoiceValue = totalInvoices > 0 ? totalSales / totalInvoices : 0
    const totalItemsSold = invoices.reduce((sum, inv) => {
      return sum + inv.items.reduce((itemSum, item) => itemSum + item.quantity, 0)
    }, 0)

    return NextResponse.json({
      period: {
        year,
        month,
        monthName: format(monthStart, 'MMMM yyyy'),
        start: monthStart.toISOString(),
        end: monthEnd.toISOString(),
      },
      summary: {
        totalSales,
        subtotalWithoutTaxes,
        totalTaxes,
        costOfGoodsSold,
        grossProfit,
        totalProfit,
        profitMargin: Math.round(profitMargin * 100) / 100,
        totalInvoices,
        averageInvoiceValue,
        totalItemsSold,
      },
      salesByDay,
      salesByPaymentMethod,
      topProducts,
    })
  } catch (error) {
    console.error('Error fetching monthly report:', error)
    return NextResponse.json(
      { error: 'Failed to fetch monthly report' },
      { status: 500 }
    )
  }
}

