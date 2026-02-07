import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/api-middleware'
import { PERMISSIONS } from '@/lib/permissions'
import { getPrismaForRequest } from '@/lib/get-tenant-prisma'

/**
 * GET /api/credit-notes/[id]
 * Get credit note details
 */
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

    const prisma = await getPrismaForRequest(request, session)

    try {
        const creditNote = await prisma.creditNote.findUnique({
            where: { id: creditNoteId },
            include: {
                invoice: {
                    include: {
                        customer: true,
                        items: true
                    }
                },
                return: {
                    include: {
                        items: true,
                        payments: true
                    }
                },
                items: {
                    include: {
                        product: {
                            select: {
                                name: true,
                                sku: true
                            }
                        },
                        variant: {
                            select: {
                                name: true,
                                sku: true
                            }
                        },
                        lineTaxes: true
                    }
                },
                taxSummary: true,
                transmission: {
                    include: {
                        events: {
                            orderBy: {
                                createdAt: 'desc'
                            }
                        }
                    }
                },
                createdBy: {
                    select: {
                        name: true,
                        email: true
                    }
                }
            }
        })

        if (!creditNote) {
            return NextResponse.json({ error: 'Nota crédito no encontrada' }, { status: 404 })
        }

        return NextResponse.json(creditNote)
    } catch (error: any) {
        return NextResponse.json({ error: error.message || 'Error al obtener nota crédito' }, { status: 500 })
    }
}
