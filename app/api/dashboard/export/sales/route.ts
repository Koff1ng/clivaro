import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/api-middleware'
import { PERMISSIONS } from '@/lib/permissions'
import { getPrismaForRequest } from '@/lib/get-tenant-prisma'
import { logger } from '@/lib/logger'
import * as XLSX from 'xlsx'
import { format } from 'date-fns'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
    const startTime = Date.now()

    try {
        const session = await requirePermission(request as any, PERMISSIONS.VIEW_REPORTS)

        if (session instanceof NextResponse) {
            return session
        }

        const { searchParams } = new URL(request.url)
        const year = parseInt(searchParams.get('year') || String(new Date().getFullYear()))
        const month = parseInt(searchParams.get('month') || String(new Date().getMonth() + 1))

        const monthStart = new Date(year, month - 1, 1)
        const monthEnd = new Date(year, month, 0, 23, 59, 59, 999)

        const prisma = await getPrismaForRequest(request, session)

        const invoices = await prisma.invoice.findMany({
            where: {
                issuedAt: {
                    gte: monthStart,
                    lte: monthEnd,
                },
            },
            include: {
                customer: {
                    select: { name: true, taxId: true }
                },
                payments: {
                    select: { amount: true, method: true }
                }
            },
            orderBy: { createdAt: 'desc' }
        })

        // Prepare data for Excel
        const data = invoices.map(inv => ({
            'Número': inv.number,
            'Fecha': format(inv.issuedAt || inv.createdAt, 'dd/MM/yyyy HH:mm'),
            'Cliente': inv.customer?.name || 'Cliente General',
            'NIT/CC': inv.customer?.taxId || '',
            'Estado': inv.status,
            'Subtotal': inv.subtotal,
            'Descuento': inv.discount,
            'Impuesto': inv.tax,
            'Total': inv.total,
            'Pagado': inv.payments.reduce((sum, p) => sum + p.amount, 0),
            'Métodos': inv.payments.map(p => p.method).join(', ')
        }))

        // Create workbook
        const worksheet = XLSX.utils.json_to_sheet(data)
        const workbook = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Ventas')

        // Generate buffer
        const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' })

        const fileName = `Ventas_${year}_${month}.xlsx`

        const duration = Date.now() - startTime
        logger.apiResponse('GET', '/api/dashboard/export/sales', 200, duration)

        return new NextResponse(buffer, {
            headers: {
                'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'Content-Disposition': `attachment; filename="${fileName}"`,
            },
        })
    } catch (error: any) {
        logger.error('Error exporting sales to Excel', error, { endpoint: '/api/dashboard/export/sales' })
        return NextResponse.json(
            { error: 'Failed to export sales' },
            { status: 500 }
        )
    }
}
