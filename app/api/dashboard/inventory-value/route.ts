import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/api-middleware'
import { PERMISSIONS } from '@/lib/permissions'
import { withTenantRead } from '@/lib/tenancy'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
    const session = await requirePermission(request as any, PERMISSIONS.VIEW_REPORTS)
    if (session instanceof NextResponse) return session

    const tenantId = (session.user as any).tenantId
    if (!tenantId) {
        return NextResponse.json({ summary: { totalValue: 0, totalMarketValue: 0, potentialProfit: 0, totalItems: 0, productCount: 0 }, categoryBreakdown: [] }, { status: 403 })
    }

    try {
        const result = await withTenantRead(tenantId, async (prisma) => {
            const [products, stockLevels] = await Promise.all([
                prisma.product.findMany({
                    where: { active: true, trackStock: true },
                    select: {
                        id: true,
                        name: true,
                        category: true,
                        cost: true,
                        price: true,
                        variants: { where: { active: true }, select: { id: true, cost: true, price: true } }
                    }
                }),
                prisma.stockLevel.findMany({
                    where: { product: { active: true, trackStock: true } },
                    select: { productId: true, variantId: true, quantity: true }
                })
            ])

            const productMap = new Map<string, any>()
            products.forEach((p: any) => productMap.set(p.id, p))

            let totalValue = 0, totalMarketValue = 0, totalItems = 0
            const categoryBreakdown: Record<string, { value: number; marketValue: number; stock: number }> = {}

            stockLevels.forEach((sl: any) => {
                if (!sl.productId) return
                const product = productMap.get(sl.productId)
                if (!product) return

                let cost = Number(product.cost || 0)
                let price = Number(product.price || 0)

                if (sl.variantId && product.variants) {
                    const variant = product.variants.find((v: any) => v.id === sl.variantId)
                    if (variant) {
                        if (variant.cost != null) cost = Number(variant.cost)
                        if (variant.price != null) price = Number(variant.price)
                    }
                }

                const stock = Number(sl.quantity || 0)
                totalValue += stock * cost
                totalMarketValue += stock * price
                totalItems += stock

                const category = product.category || 'Sin categoría'
                if (!categoryBreakdown[category]) categoryBreakdown[category] = { value: 0, marketValue: 0, stock: 0 }
                categoryBreakdown[category].value += stock * cost
                categoryBreakdown[category].marketValue += stock * price
                categoryBreakdown[category].stock += stock
            })

            return {
                summary: {
                    totalValue: Math.round(totalValue * 100) / 100,
                    totalMarketValue: Math.round(totalMarketValue * 100) / 100,
                    potentialProfit: Math.round((totalMarketValue - totalValue) * 100) / 100,
                    totalItems: Math.round(totalItems * 100) / 100,
                    productCount: products.length,
                },
                categoryBreakdown: Object.entries(categoryBreakdown)
                    .map(([name, data]) => ({
                        name,
                        value: Math.round(data.value * 100) / 100,
                        marketValue: Math.round(data.marketValue * 100) / 100,
                        stock: Math.round(data.stock * 100) / 100
                    }))
                    .sort((a, b) => b.value - a.value)
            }
        })

        return NextResponse.json(result)
    } catch (error: any) {
        logger.error('Error fetching inventory value', error, { endpoint: '/api/dashboard/inventory-value' })
        return NextResponse.json({ summary: { totalValue: 0, totalMarketValue: 0, potentialProfit: 0, totalItems: 0, productCount: 0 }, categoryBreakdown: [] }, { status: 500 })
    }
}
