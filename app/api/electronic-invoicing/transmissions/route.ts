import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/api-middleware'
import { PERMISSIONS } from '@/lib/permissions'
import { withTenantRead, getTenantIdFromSession } from '@/lib/tenancy'
import { logger } from '@/lib/logger'

export async function GET(request: Request) {
    const session = await requirePermission(request as any, PERMISSIONS.MANAGE_SALES)
    if (session instanceof NextResponse) return session

    const tenantId = getTenantIdFromSession(session)
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const skip = (page - 1) * limit

    try {
        const result = await withTenantRead(tenantId, async (prisma) => {
            const [transmissions, total] = await Promise.all([
                (prisma as any).electronicInvoiceTransmission.findMany({
                    skip,
                    take: limit,
                    include: {
                        invoice: {
                            select: {
                                number: true,
                                total: true,
                                customer: { select: { name: true } }
                            }
                        },
                        events: {
                            orderBy: { createdAt: 'desc' },
                            take: 1
                        }
                    },
                    orderBy: { updatedAt: 'desc' }
                }),
                (prisma as any).electronicInvoiceTransmission.count()
            ])
            return { transmissions, total }
        })

        return NextResponse.json({
            transmissions: result.transmissions,
            pagination: {
                page,
                limit,
                total: result.total,
                totalPages: Math.ceil(result.total / limit)
            }
        })
    } catch (error: any) {
        logger.error('[Transmissions API Error]:', error)
        return NextResponse.json({ error: error.message || 'Error al cargar las transmisiones' }, { status: 500 })
    }
}
