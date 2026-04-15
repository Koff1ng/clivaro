import { NextResponse } from 'next/server'
import { logger } from '@/lib/logger'
import { requireAnyPermission } from '@/lib/api-middleware'
import { PERMISSIONS } from '@/lib/permissions'
import { getTenantIdFromSession, withTenantRead } from '@/lib/tenancy'

export const dynamic = 'force-dynamic'
import { safeErrorMessage } from '@/lib/safe-error'

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
            const activeItems = allItems.filter((i: any) => i.status !== 'CANCELLED')
            const subtotalGross = activeItems.reduce((sum: number, item: any) => sum + (item.unitPrice * item.quantity), 0)
            const taxAmount = activeItems.reduce((sum: number, item: any) => {
                const rate = item.product?.taxRate || 0
                if (rate <= 0) return sum
                const gross = item.unitPrice * item.quantity
                const base = gross / (1 + rate / 100)
                return sum + (gross - base)
            }, 0)
            const subtotalNet = Math.round((subtotalGross - taxAmount) * 100) / 100

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
                itemsCount: activeItems.length,
                subtotal: Math.round(subtotalGross),
                taxAmount: Math.round(taxAmount),
                total: Math.round(subtotalGross),
                tipAmount: s.tipAmount || 0,
                discountAmount: s.discountAmount || 0,
                customerId: s.customerId || null,
                customerName: s.customer?.name || null,
                customerTaxId: s.customer?.taxId || null,
                lines: allItems.map((item: any) => ({
                    id: item.id,
                    productId: item.productId,
                    productName: item.product?.name || 'N/A',
                    quantity: item.quantity,
                    unitPrice: item.unitPrice,
                    originalPrice: item.originalPrice ?? item.unitPrice,
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
        logger.error('Error in open-accounts GET:', error)
        return NextResponse.json({ error: safeErrorMessage(error) }, { status: 500 })
    }
}
