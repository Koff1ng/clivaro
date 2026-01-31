import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/api-middleware'
import { PERMISSIONS } from '@/lib/permissions'
import { getPrismaForRequest } from '@/lib/get-tenant-prisma'
import { z } from 'zod'

const opportunitySchema = z.object({
    customerId: z.string(),
    campaignId: z.string().optional().nullable(),
    title: z.string().min(1),
    value: z.number().min(0),
    stage: z.enum(['LEAD', 'QUALIFIED', 'PROPOSAL', 'NEGOTIATION', 'CLOSED_WON', 'CLOSED_LOST']).optional(),
    probability: z.number().min(0).max(100).optional(),
    expectedCloseDate: z.string().optional().nullable(),
    notes: z.string().optional().nullable(),
    assignedToId: z.string().optional().nullable(),
})

export async function GET(request: Request) {
    const session = await requirePermission(request as any, PERMISSIONS.MANAGE_SALES)
    if (session instanceof NextResponse) return session

    const prisma = await getPrismaForRequest(request, session)

    try {
        const { searchParams } = new URL(request.url)
        const stage = searchParams.get('stage')
        const customerId = searchParams.get('customerId')
        const campaignId = searchParams.get('campaignId')
        const assignedToId = searchParams.get('assignedToId')

        const where: any = {}
        if (stage) where.stage = stage
        if (customerId) where.customerId = customerId
        if (campaignId) where.campaignId = campaignId
        if (assignedToId) where.assignedToId = assignedToId

        const opportunities = await prisma.opportunity.findMany({
            where,
            include: {
                customer: true,
                campaign: true,
                assignedTo: {
                    select: { id: true, name: true, email: true }
                },
                createdBy: {
                    select: { name: true, email: true }
                },
                _count: {
                    select: { quotes: true }
                }
            },
            orderBy: { createdAt: 'desc' }
        })

        return NextResponse.json(opportunities)
    } catch (error) {
        console.error('Error fetching opportunities:', error)
        return NextResponse.json({ error: 'Failed to fetch opportunities' }, { status: 500 })
    }
}

export async function POST(request: Request) {
    const session = await requirePermission(request as any, PERMISSIONS.MANAGE_SALES)
    if (session instanceof NextResponse) return session

    const prisma = await getPrismaForRequest(request, session)

    try {
        const body = await request.json()
        const data = opportunitySchema.parse(body)

        const opportunity = await prisma.opportunity.create({
            data: {
                ...data,
                expectedCloseDate: data.expectedCloseDate ? new Date(data.expectedCloseDate) : null,
                createdById: (session.user as any).id,
            },
            include: {
                customer: true,
                campaign: true,
                assignedTo: {
                    select: { id: true, name: true, email: true }
                }
            }
        })

        return NextResponse.json(opportunity)
    } catch (error) {
        console.error('Error creating opportunity:', error)
        return NextResponse.json({ error: 'Failed to create opportunity' }, { status: 500 })
    }
}
