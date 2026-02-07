import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/api-middleware'
import { PERMISSIONS } from '@/lib/permissions'
import { getPrismaForRequest } from '@/lib/get-tenant-prisma'
import { getTenantIdFromSession } from '@/lib/tenancy'

/**
 * GET /api/credit-notes
 * List all credit notes with filters
 */
export async function GET(request: Request) {
    const session = await requirePermission(request as any, [
        PERMISSIONS.MANAGE_SALES,
        PERMISSIONS.MANAGE_RETURNS
    ])
    if (session instanceof NextResponse) return session

    const prisma = await getPrismaForRequest(request, session)
    const tenantId = getTenantIdFromSession(session)

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') || undefined
    const electronicStatus = searchParams.get('electronicStatus') || undefined
    const customerId = searchParams.get('customerId') || undefined
    const startDate = searchParams.get('startDate') ? new Date(searchParams.get('startDate')!) : undefined
    const endDate = searchParams.get('endDate') ? new Date(searchParams.get('endDate')!) : undefined

    try {
        const where: any = {}
        if (status && status !== 'ALL') where.status = status
        if (electronicStatus) where.electronicStatus = electronicStatus
        if (startDate || endDate) {
            where.createdAt = {}
            if (startDate) where.createdAt.gte = startDate
            if (endDate) where.createdAt.lte = endDate
        }

        const creditNotes = await prisma.creditNote.findMany({
            where,
            include: {
                invoice: {
                    select: {
                        number: true,
                        customer: {
                            select: {
                                name: true,
                                taxId: true
                            }
                        }
                    }
                },
                createdBy: {
                    select: {
                        name: true
                    }
                },
                _count: {
                    select: {
                        items: true
                    }
                }
            },
            orderBy: {
                createdAt: 'desc'
            },
            take: 100
        })

        return NextResponse.json(creditNotes)
    } catch (error: any) {
        return NextResponse.json({ error: error.message || 'Error al listar notas crédito' }, { status: 500 })
    }
}
