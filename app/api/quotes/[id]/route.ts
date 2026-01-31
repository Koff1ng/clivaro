import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/api-middleware'
import { PERMISSIONS } from '@/lib/permissions'
import { getPrismaForRequest } from '@/lib/get-tenant-prisma'
import { z } from 'zod'

const updateQuoteSchema = z.object({
    status: z.enum(['DRAFT', 'SENT', 'ACCEPTED', 'REJECTED', 'EXPIRED']).optional(),
    validUntil: z.string().optional().nullable(),
    notes: z.string().optional().nullable(),
})

export async function GET(
    request: Request,
    { params }: { params: { id: string } }
) {
    const session = await requirePermission(request as any, PERMISSIONS.MANAGE_SALES)
    if (session instanceof NextResponse) return session

    const prisma = await getPrismaForRequest(request, session)

    try {
        const quote = await prisma.quote.findUnique({
            where: { id: params.id },
            include: {
                customer: true,
                opportunity: true,
                items: {
                    include: {
                        product: true
                    }
                },
                createdBy: {
                    select: { name: true, email: true }
                }
            }
        })

        if (!quote) {
            return NextResponse.json({ error: 'Quote not found' }, { status: 404 })
        }

        return NextResponse.json(quote)
    } catch (error) {
        console.error('Error fetching quote:', error)
        return NextResponse.json({ error: 'Failed to fetch quote' }, { status: 500 })
    }
}

export async function PATCH(
    request: Request,
    { params }: { params: { id: string } }
) {
    const session = await requirePermission(request as any, PERMISSIONS.MANAGE_SALES)
    if (session instanceof NextResponse) return session

    const prisma = await getPrismaForRequest(request, session)

    try {
        const body = await request.json()
        const data = updateQuoteSchema.parse(body)

        const quote = await prisma.quote.update({
            where: { id: params.id },
            data: {
                ...data,
                validUntil: data.validUntil ? new Date(data.validUntil) : undefined,
            },
            include: {
                customer: true,
                items: {
                    include: {
                        product: true
                    }
                }
            }
        })

        return NextResponse.json(quote)
    } catch (error) {
        console.error('Error updating quote:', error)
        return NextResponse.json({ error: 'Failed to update quote' }, { status: 500 })
    }
}

export async function DELETE(
    request: Request,
    { params }: { params: { id: string } }
) {
    const session = await requirePermission(request as any, PERMISSIONS.MANAGE_SALES)
    if (session instanceof NextResponse) return session

    const prisma = await getPrismaForRequest(request, session)

    try {
        await prisma.quote.delete({
            where: { id: params.id }
        })

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('Error deleting quote:', error)
        return NextResponse.json({ error: 'Failed to delete quote' }, { status: 500 })
    }
}
