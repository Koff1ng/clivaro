import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/api-middleware'
import { PERMISSIONS } from '@/lib/permissions'
import { getPrismaForRequest } from '@/lib/get-tenant-prisma'
import { z } from 'zod'

const updateOpportunitySchema = z.object({
    customerId: z.string().optional(),
    campaignId: z.string().optional().nullable(),
    title: z.string().min(1).optional(),
    value: z.number().min(0).optional(),
    stage: z.enum(['LEAD', 'QUALIFIED', 'PROPOSAL', 'NEGOTIATION', 'CLOSED_WON', 'CLOSED_LOST']).optional(),
    probability: z.number().min(0).max(100).optional(),
    expectedCloseDate: z.string().optional().nullable(),
    closedDate: z.string().optional().nullable(),
    notes: z.string().optional().nullable(),
    assignedToId: z.string().optional().nullable(),
})

export async function PATCH(
    request: Request,
    { params }: { params: { id: string } }
) {
    const session = await requirePermission(request as any, PERMISSIONS.MANAGE_SALES)
    if (session instanceof NextResponse) return session

    const prisma = await getPrismaForRequest(request, session)

    try {
        const body = await request.json()
        const data = updateOpportunitySchema.parse(body)

        const opportunity = await prisma.opportunity.update({
            where: { id: params.id },
            data: {
                ...data,
                expectedCloseDate: data.expectedCloseDate ? new Date(data.expectedCloseDate) : undefined,
                closedDate: data.closedDate ? new Date(data.closedDate) : undefined,
            },
            include: {
                customer: true,
                campaign: true,
                assignedTo: {
                    select: { id: true, name: true, email: true }
                },
                quotes: true
            }
        })

        return NextResponse.json(opportunity)
    } catch (error) {
        console.error('Error updating opportunity:', error)
        return NextResponse.json({ error: 'Failed to update opportunity' }, { status: 500 })
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
        await prisma.opportunity.delete({
            where: { id: params.id }
        })

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('Error deleting opportunity:', error)
        return NextResponse.json({ error: 'Failed to delete opportunity' }, { status: 500 })
    }
}
