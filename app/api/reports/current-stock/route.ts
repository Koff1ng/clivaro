import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/api-middleware'
import { PERMISSIONS } from '@/lib/permissions'
import { getPrismaForRequest } from '@/lib/get-tenant-prisma'
import { logger } from '@/lib/logger'

export async function GET(request: Request) {
    const session = await requirePermission(request as any, PERMISSIONS.VIEW_REPORTS)

    if (session instanceof NextResponse) {
        return session
    }

    const prisma = await getPrismaForRequest(request, session)
    const startTime = Date.now()

    try {
        const { searchParams } = new URL(request.url)
        const warehouseId = searchParams.get('warehouseId')

        const where: any = {
            active: true,
            trackStock: true,
        }

        // Fetch products with their stock levels
        const products = await prisma.product.findMany({
            where,
            select: {
                id: true,
                sku: true,
                name: true,
                category: true,
                cost: true,
                price: true,
                stockLevels: {
                    where: warehouseId ? { warehouseId } : undefined,
                    include: {
                        warehouse: {
                            select: {
                                name: true
                            }
                        }
                    }
                }
            },
            orderBy: { name: 'asc' }
        })

        // Process and aggregate
        const reportData = products.map(p => {
            const totalQuantity = p.stockLevels.reduce((sum, sl) => sum + sl.quantity, 0)
            const totalCostValue = totalQuantity * (p.cost || 0)
            const totalPriceValue = totalQuantity * p.price

            return {
                id: p.id,
                sku: p.sku,
                name: p.name,
                category: p.category || 'Sin categoría',
                cost: p.cost || 0,
                price: p.price,
                totalQuantity,
                totalCostValue,
                totalPriceValue,
                stockByWarehouse: p.stockLevels.map(sl => ({
                    warehouseName: sl.warehouse.name,
                    quantity: sl.quantity
                }))
            }
        })

        // Summary statistics
        const totalInventoryValueCost = reportData.reduce((sum, item) => sum + item.totalCostValue, 0)
        const totalInventoryValuePrice = reportData.reduce((sum, item) => sum + item.totalPriceValue, 0)
        const totalItemsCount = reportData.reduce((sum, item) => sum + item.totalQuantity, 0)
        const distinctProductsCount = reportData.filter(item => item.totalQuantity > 0).length

        const result = {
            summary: {
                totalInventoryValueCost,
                totalInventoryValuePrice,
                totalItemsCount,
                distinctProductsCount,
                potentialProfit: totalInventoryValuePrice - totalInventoryValueCost
            },
            items: reportData
        }

        const duration = Date.now() - startTime
        logger.apiResponse('GET', '/api/reports/current-stock', 200, duration)

        return NextResponse.json(result)
    } catch (error: any) {
        logger.error('Error fetching current stock report', error, {
            endpoint: '/api/reports/current-stock',
        })
        return NextResponse.json(
            { error: error?.message || 'Failed to fetch report' },
            { status: 500 }
        )
    }
}
