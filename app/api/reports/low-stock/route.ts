import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/api-middleware'
import { PERMISSIONS } from '@/lib/permissions'
import { withTenantRead } from '@/lib/tenancy'
import { logger } from '@/lib/logger'

export async function GET(request: Request) {
    const session = await requirePermission(request as any, PERMISSIONS.VIEW_REPORTS)

    if (session instanceof NextResponse) {
        return session
    }

    const tenantId = (session.user as any).tenantId
    const startTime = Date.now()

    try {
        const { searchParams } = new URL(request.url)
        const warehouseId = searchParams.get('warehouseId')

        const result = await withTenantRead(tenantId, async (prisma) => {
            // Fetch products that have stock below or equal to minStock
            const products = await prisma.product.findMany({
                where: {
                    active: true,
                    trackStock: true,
                    stockLevels: {
                        some: {
                            warehouseId: warehouseId ? warehouseId : undefined,
                            quantity: {
                                lte: prisma.stockLevel.fields.minStock
                            }
                        }
                    }
                },
                include: {
                    stockLevels: {
                        where: warehouseId ? { warehouseId } : undefined,
                        include: {
                            warehouse: {
                                select: { name: true }
                            }
                        }
                    }
                },
                orderBy: { name: 'asc' }
            })

            const lowStockItems = products.map(p => {
                const relevantStocks = p.stockLevels.filter(sl => sl.quantity <= sl.minStock)

                return {
                    id: p.id,
                    sku: p.sku,
                    name: p.name,
                    category: p.category || 'Sin categoría',
                    cost: p.cost,
                    price: p.price,
                    stockByWarehouse: relevantStocks.map(sl => ({
                        warehouseName: sl.warehouse.name,
                        quantity: sl.quantity,
                        minStock: sl.minStock,
                        deficit: sl.minStock - sl.quantity
                    }))
                }
            })

            return {
                items: lowStockItems,
                summary: {
                    totalCount: lowStockItems.length,
                    totalDeficit: lowStockItems.reduce((acc, item) =>
                        acc + item.stockByWarehouse.reduce((s, sw) => s + sw.deficit, 0), 0)
                }
            }
        })

        const duration = Date.now() - startTime
        logger.apiResponse('GET', '/api/reports/low-stock', 200, duration)

        return NextResponse.json(result)
    } catch (error: any) {
        logger.error('Error fetching low stock report', error, {
            endpoint: '/api/reports/low-stock',
        })
        return NextResponse.json(
            { error: error?.message || 'Failed to fetch report' },
            { status: 500 }
        )
    }
}
