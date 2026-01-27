import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/api-middleware'
import { PERMISSIONS } from '@/lib/permissions'
import { getPrismaForRequest } from '@/lib/get-tenant-prisma'
import { logger } from '@/lib/logger'

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
                    category: true,
                    cost: true,
                    trackStock: true,
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

        let totalValue = 0
        let totalItems = 0
        const categoryBreakdown: Record<string, { value: number; stock: number }> = {}

        products.forEach(p => {
            const stock = stockByProduct.get(p.id) || 0
            const cost = Number(p.cost || 0)
            const value = stock * cost

            if (stock > 0 || value > 0) {
                totalValue += value
                totalItems += stock

                const category = p.category || 'Sin categoría'
                if (!categoryBreakdown[category]) {
                    categoryBreakdown[category] = { value: 0, stock: 0 }
                }
                categoryBreakdown[category].value += value
                categoryBreakdown[category].stock += stock
            }
        })

        const result = {
            summary: {
                totalValue: Math.round(totalValue * 100) / 100,
                totalItems: Math.round(totalItems * 100) / 100,
                productCount: products.length,
            },
            categoryBreakdown: Object.entries(categoryBreakdown).map(([name, data]) => ({
                name,
                value: Math.round(data.value * 100) / 100,
                stock: Math.round(data.stock * 100) / 100,
            })).sort((a, b) => b.value - a.value)
        }

        const duration = Date.now() - startTime
        logger.apiResponse('GET', '/api/dashboard/inventory-value', 200, duration)

        return NextResponse.json(result)
    } catch (error: any) {
        logger.error('Error fetching inventory value', error, { endpoint: '/api/dashboard/inventory-value' })
        return NextResponse.json(
            { error: 'Failed to fetch inventory value' },
            { status: 500 }
        )
    }
}
