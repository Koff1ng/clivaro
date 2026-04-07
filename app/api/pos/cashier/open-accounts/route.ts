import { NextResponse } from 'next/server'
import { requireAnyPermission } from '@/lib/api-middleware'
import { PERMISSIONS } from '@/lib/permissions'
import { getTenantIdFromSession, withTenantRead } from '@/lib/tenancy'

export const dynamic = 'force-dynamic'

/**
 * GET: Lists all open table sessions for the cashier view.
 * Returns active sessions with table, zone, waiter, orders and totals.
 */
export async function GET(request: Request) {
    const session = await requireAnyPermission(request as any, [PERMISSIONS.MANAGE_SALES, PERMISSIONS.MANAGE_CASH])
    if (session instanceof NextResponse) return session

    const tenantId = getTenantIdFromSession(session)

    try {
        const { searchParams } = new URL(request.url)
        const statusFilter = searchParams.get('status') || 'OPEN'

        const sessions = await withTenantRead(tenantId, async (prisma) => {
            return await (prisma as any).tableSession.findMany({
                where: {
                    status: statusFilter === 'all' ? undefined : statusFilter,
                },
                include: {
                    table: {
                        include: {
                            zone: { select: { id: true, name: true } }
                        }
                    },
                    waiter: {
                        select: { id: true, name: true, code: true }
                    },
                    orders: {
                        include: {
                            items: {
                                include: {
                                    product: { select: { id: true, name: true, price: true, taxRate: true } }
                                }
                            }
                        }
                    }
                },
                orderBy: { openedAt: 'asc' }
            })
        })

        // Enrich with computed fields
        const enriched = sessions.map((s: any) => {
            const allItems = s.orders.flatMap((o: any) => o.items)
            const subtotal = allItems.reduce((sum: number, item: any) => sum + (item.unitPrice * item.quantity), 0)
            const taxAmount = allItems.reduce((sum: number, item: any) => {
                const base = (item.unitPrice * item.quantity) / (1 + (item.product?.taxRate || 0) / 100)
                return sum + ((item.unitPrice * item.quantity) - base)
            }, 0)

            const elapsedMs = Date.now() - new Date(s.openedAt).getTime()
            const elapsedMinutes = Math.floor(elapsedMs / 60000)

            return {
                id: s.id,
                tableNumber: s.table?.name || 'N/A',
                zoneName: s.table?.zone?.name || 'N/A',
                zoneId: s.table?.zone?.id,
                waiterName: s.waiter?.name || 'N/A',
                waiterCode: s.waiter?.code,
                status: s.status,
                openedAt: s.openedAt,
                elapsedMinutes,
                itemsCount: allItems.length,
                subtotal: Math.round(subtotal),
                taxAmount: Math.round(taxAmount),
                total: Math.round(subtotal),
                tipAmount: s.tipAmount || 0,
                lines: allItems.map((item: any) => ({
                    id: item.id,
                    productId: item.productId,
                    productName: item.product?.name || 'N/A',
                    quantity: item.quantity,
                    unitPrice: item.unitPrice,
                    notes: item.notes,
                    status: item.status,
                })),
            }
        })

        return NextResponse.json({
            accounts: enriched,
            total: enriched.length,
        })
    } catch (error: any) {
        console.error('Error in open-accounts GET:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
