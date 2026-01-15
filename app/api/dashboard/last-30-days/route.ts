import { NextResponse } from 'next/server'
import { requireAnyPermission } from '@/lib/api-middleware'
import { PERMISSIONS } from '@/lib/permissions'
import { getPrismaForRequest } from '@/lib/get-tenant-prisma'

export async function GET(request: Request) {
  const session = await requireAnyPermission(request as any, [PERMISSIONS.VIEW_REPORTS, PERMISSIONS.MANAGE_SALES])
  
  if (session instanceof NextResponse) {
    return session
  }

  const prisma = await getPrismaForRequest(request, session)

  try {
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    // Obtener ventas de los últimos 30 días agrupadas por día
    const invoices = await prisma.invoice.findMany({
      where: {
        createdAt: {
          gte: thirtyDaysAgo,
        },
        status: {
          in: ['PAGADA', 'PAID', 'EN_COBRANZA', 'PARCIAL', 'PARTIAL'], // Compatibilidad con estados antiguos y nuevos
        },
      },
      select: {
        total: true,
        createdAt: true,
      },
    })

    // Agrupar por día
    const salesByDay: Record<string, number> = {}
    invoices.forEach(invoice => {
      const dateKey = invoice.createdAt.toISOString().split('T')[0]
      salesByDay[dateKey] = (salesByDay[dateKey] || 0) + invoice.total
    })

    // Generar array para los últimos 30 días
    const days = []
    for (let i = 29; i >= 0; i--) {
      const date = new Date()
      date.setDate(date.getDate() - i)
      const dateKey = date.toISOString().split('T')[0]
      days.push({
        day: date.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' }),
        sales: salesByDay[dateKey] || 0,
      })
    }

    return NextResponse.json(days)
  } catch (error) {
    console.error('Error fetching last 30 days:', error)
    return NextResponse.json(
      { error: 'Failed to fetch last 30 days data' },
      { status: 500 }
    )
  }
}

