import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/api-middleware'
import { PERMISSIONS } from '@/lib/permissions'
import { getPrismaForRequest } from '@/lib/get-tenant-prisma'
import { logger } from '@/lib/logger'

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
                    category: true,
                    cost: true,
                    price: true,
                    trackStock: true,
                    variants: {
                        where: { active: true },
                        select: {
                            id: true,
                            cost: true,
                            price: true,
                        }
                    }
                }
            }),
            prisma.stockLevel.findMany({
                select: {
                    productId: true,
                    variantId: true,
                    quantity: true,
                    warehouseId: true,
                }
            })
        ])

        // Create a map of products for easy lookup
        const productMap = new Map<string, any>()
        products.forEach(p => productMap.set(p.id, p))

        let totalValue = 0
        let totalMarketValue = 0
        let totalItems = 0
        const categoryBreakdown: Record<string, { value: number; marketValue: number; stock: number }> = {}

        stockLevels.forEach(sl => {
            if (!sl.productId) return

            const product = productMap.get(sl.productId)
            if (!product) return

            let cost = Number(product.cost || 0)
            let price = Number(product.price || 0)

            // If variantId exists, try to get variant cost/price
            if (sl.variantId && product.variants) {
                const variant = product.variants.find((v: any) => v.id === sl.variantId)
                if (variant) {
                    if (variant.cost !== null && variant.cost !== undefined) {
                        cost = Number(variant.cost)
                    }
                    if (variant.price !== null && variant.price !== undefined) {
                        price = Number(variant.price)
                    }
                }
            }

            const stock = Number(sl.quantity || 0)
            const value = stock * cost
            const marketValue = stock * price

            if (stock > 0 || value > 0 || marketValue > 0) {
                totalValue += value
                totalMarketValue += marketValue
                totalItems += stock

                const category = product.category || 'Sin categoría'
                if (!categoryBreakdown[category]) {
                    categoryBreakdown[category] = { value: 0, marketValue: 0, stock: 0 }
                }
                categoryBreakdown[category].value += value
                categoryBreakdown[category].marketValue += marketValue
                categoryBreakdown[category].stock += stock
            }
        })

        const result = {
            summary: {
                totalValue: Math.round(totalValue * 100) / 100,
                totalMarketValue: Math.round(totalMarketValue * 100) / 100,
                potentialProfit: Math.round((totalMarketValue - totalValue) * 100) / 100,
                totalItems: Math.round(totalItems * 100) / 100,
                productCount: products.length,
            },
            categoryBreakdown: Object.entries(categoryBreakdown).map(([name, data]) => ({
                name,
                value: Math.round(data.value * 100) / 100,
                marketValue: Math.round(data.marketValue * 100) / 100,
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
