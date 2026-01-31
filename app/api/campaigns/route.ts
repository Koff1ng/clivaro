import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/api-middleware'
import { PERMISSIONS } from '@/lib/permissions'
import { getPrismaForRequest } from '@/lib/get-tenant-prisma'
import { z } from 'zod'

const campaignSchema = z.object({
    name: z.string().min(1),
    type: z.enum(['EMAIL', 'SMS', 'SOCIAL_MEDIA', 'EVENT']),
    status: z.enum(['DRAFT', 'ACTIVE', 'PAUSED', 'COMPLETED']).optional(),
    startDate: z.string().optional().nullable(),
    endDate: z.string().optional().nullable(),
    budget: z.number().optional().nullable(),
    spent: z.number().optional(),
    description: z.string().optional().nullable(),
})

export async function GET(request: Request) {
    const session = await requirePermission(request as any, PERMISSIONS.MANAGE_SALES)
    if (session instanceof NextResponse) return session

    const prisma = await getPrismaForRequest(request, session)

    try {
        const { searchParams } = new URL(request.url)
        const status = searchParams.get('status')
        const type = searchParams.get('type')

        const where: any = {}
        if (status) where.status = status
        if (type) where.type = type

        const campaigns = await prisma.campaign.findMany({
            where,
            include: {
                _count: {
                    select: { opportunities: true }
                },
                createdBy: {
                    select: { name: true, email: true }
                }
            },
            orderBy: { createdAt: 'desc' }
        })

        return NextResponse.json(campaigns)
    } catch (error) {
        console.error('Error fetching campaigns:', error)
        return NextResponse.json(
            { error: 'Failed to fetch campaigns' },
            { status: 500 }
        )
    }
}

export async function POST(request: Request) {
    const session = await requirePermission(request as any, PERMISSIONS.MANAGE_SALES)
    if (session instanceof NextResponse) return session

    const prisma = await getPrismaForRequest(request, session)

    try {
        const body = await request.json()
        const data = campaignSchema.parse(body)

        const campaign = await prisma.campaign.create({
            data: {
                ...data,
                startDate: data.startDate ? new Date(data.startDate) : null,
                endDate: data.endDate ? new Date(data.endDate) : null,
                createdById: (session.user as any).id,
            },
            include: {
                createdBy: {
                    select: { name: true, email: true }
                }
            }
        })

        return NextResponse.json(campaign)
    } catch (error) {
        console.error('Error creating campaign:', error)
        return NextResponse.json(
            { error: 'Failed to create campaign' },
            { status: 500 }
        )
    }
}
