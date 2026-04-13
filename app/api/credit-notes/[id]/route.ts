import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/api-middleware'
import { PERMISSIONS } from '@/lib/permissions'
import { withTenantRead, getTenantIdFromSession } from '@/lib/tenancy'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'
import { safeErrorMessage } from '@/lib/safe-error'

export async function GET(
    request: Request,
    { params }: { params: { id: string } | Promise<{ id: string }> }
) {
    const resolvedParams = await Promise.resolve(params)
    const creditNoteId = resolvedParams.id

    const session = await requirePermission(request as any, [
        PERMISSIONS.MANAGE_SALES,
        PERMISSIONS.MANAGE_RETURNS
    ])
    if (session instanceof NextResponse) return session

    const tenantId = getTenantIdFromSession(session)

    try {
        const creditNote = await withTenantRead(tenantId, async (prisma) => {
            return await prisma.creditNote.findUnique({
                where: { id: creditNoteId },
                include: {
                    invoice: { include: { customer: true, items: true } },
                    return: { include: { items: true, payments: true } },
                    items: {
                        include: {
                            product: { select: { name: true, sku: true } },
                            variant: { select: { name: true, sku: true } },
                            lineTaxes: true
                        }
                    },
                    taxSummary: true,
                    transmission: { include: { events: { orderBy: { createdAt: 'desc' } } } },
                    createdBy: { select: { name: true, email: true } }
                }
            })
        })

        if (!creditNote) return NextResponse.json({ error: 'Nota crédito no encontrada' }, { status: 404 })

        return NextResponse.json(creditNote)
    } catch (error: any) {
        logger.error('Error fetching credit note', error)
        return NextResponse.json({ error: safeErrorMessage(error, 'Error al obtener nota crédito') }, { status: 500 })
    }
}
