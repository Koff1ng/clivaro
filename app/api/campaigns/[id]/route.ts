import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/api-middleware'
import { PERMISSIONS } from '@/lib/permissions'
import { getPrismaForRequest } from '@/lib/get-tenant-prisma'
import { z } from 'zod'

const updateCampaignSchema = z.object({
    name: z.string().min(1).optional(),
    type: z.enum(['EMAIL', 'SMS', 'SOCIAL_MEDIA', 'EVENT']).optional(),
    status: z.enum(['DRAFT', 'ACTIVE', 'PAUSED', 'COMPLETED']).optional(),
    startDate: z.string().optional().nullable(),
    endDate: z.string().optional().nullable(),
    budget: z.number().optional().nullable(),
    spent: z.number().optional().nullable(),
    description: z.string().optional().nullable(),
})

export async function GET(
    request: Request,
    { params }: { params: { id: string } }
) {
    const session = await requirePermission(request as any, PERMISSIONS.MANAGE_SALES)
    if (session instanceof NextResponse) return session

    const prisma = await getPrismaForRequest(request, session)

    try {
        const campaign = await prisma.campaign.findUnique({
            where: { id: params.id },
            include: {
                opportunities: {
                    include: {
                        customer: true,
                    }
                },
                createdBy: {
                    select: { name: true, email: true }
                }
            }
        })

        if (!campaign) {
            return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
        }

        return NextResponse.json(campaign)
    } catch (error) {
        console.error('Error fetching campaign:', error)
        return NextResponse.json({ error: 'Failed to fetch campaign' }, { status: 500 })
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
        const data = updateCampaignSchema.parse(body)

        const campaign = await prisma.campaign.update({
            where: { id: params.id },
            data: {
                ...data,
                startDate: data.startDate ? new Date(data.startDate) : undefined,
                endDate: data.endDate ? new Date(data.endDate) : undefined,
            }
        })

        return NextResponse.json(campaign)
    } catch (error) {
        console.error('Error updating campaign:', error)
        return NextResponse.json({ error: 'Failed to update campaign' }, { status: 500 })
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
        await prisma.campaign.delete({
            where: { id: params.id }
        })

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('Error deleting campaign:', error)
        return NextResponse.json({ error: 'Failed to delete campaign' }, { status: 500 })
    }
}
