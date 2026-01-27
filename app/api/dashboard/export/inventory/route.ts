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

        const prisma = await getPrismaForRequest(request, session)

        // Parallel fetch products and stock levels
        const [products, stockLevels] = await Promise.all([
            prisma.product.findMany({
                where: { active: true },
                select: {
                    id: true,
                    name: true,
                    sku: true,
                    category: true,
                    cost: true,
                }
            }),
            prisma.stockLevel.findMany({
                select: {
                    productId: true,
                    quantity: true,
                    warehouseId: true,
                }
            })
        ])

        // Index stock by product
        const stockByProduct = new Map<string, number>()
        stockLevels.forEach(sl => {
            if (sl.productId) {
                stockByProduct.set(sl.productId, (stockByProduct.get(sl.productId) || 0) + Number(sl.quantity || 0))
            }
        })

        // Prepare data for Excel
        const data = products.map(p => {
            const stock = stockByProduct.get(p.id) || 0
            const cost = Number(p.cost || 0)
            const value = stock * cost

            return {
                'SKU': p.sku || '',
                'Producto': p.name,
                'Categoría': p.category || 'Sin categoría',
                'Costo Unitario': cost,
                'Stock Total': stock,
                'Valor Total': value,
            }
        }).filter(p => p['Stock Total'] > 0 || p['Valor Total'] > 0)

        // Create workbook
        const worksheet = XLSX.utils.json_to_sheet(data)
        const workbook = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Inventario')

        // Generate buffer
        const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' })

        const fileName = `Valor_Inventario_${format(new Date(), 'yyyyMMdd')}.xlsx`

        const duration = Date.now() - startTime
        logger.apiResponse('GET', '/api/dashboard/export/inventory', 200, duration)

        return new NextResponse(buffer, {
            headers: {
                'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'Content-Disposition': `attachment; filename="${fileName}"`,
            },
        })
    } catch (error: any) {
        logger.error('Error exporting inventory to Excel', error, { endpoint: '/api/dashboard/export/inventory' })
        return NextResponse.json(
            { error: 'Failed to export inventory' },
            { status: 500 }
        )
    }
}
