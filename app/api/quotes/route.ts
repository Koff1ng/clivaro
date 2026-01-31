import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/api-middleware'
import { PERMISSIONS } from '@/lib/permissions'
import { getPrismaForRequest } from '@/lib/get-tenant-prisma'
import { z } from 'zod'

const quoteItemSchema = z.object({
    productId: z.string().optional().nullable(),
    description: z.string().min(1),
    quantity: z.number().min(0),
    unitPrice: z.number().min(0),
    discount: z.number().min(0).optional(),
    taxRate: z.number().min(0).optional(),
    subtotal: z.number().min(0),
})

const quoteSchema = z.object({
    customerId: z.string(),
    opportunityId: z.string().optional().nullable(),
    status: z.enum(['DRAFT', 'SENT', 'ACCEPTED', 'REJECTED', 'EXPIRED']).optional(),
    validUntil: z.string().optional().nullable(),
    subtotal: z.number().min(0),
    discount: z.number().min(0).optional(),
    tax: z.number().min(0).optional(),
    total: z.number().min(0),
    notes: z.string().optional().nullable(),
    items: z.array(quoteItemSchema),
})

export async function GET(request: Request) {
    const session = await requirePermission(request as any, PERMISSIONS.MANAGE_SALES)
    if (session instanceof NextResponse) return session

    const prisma = await getPrismaForRequest(request, session)

    try {
        const { searchParams } = new URL(request.url)
        const status = searchParams.get('status')
        const customerId = searchParams.get('customerId')
        const opportunityId = searchParams.get('opportunityId')

        const where: any = {}
        if (status) where.status = status
        if (customerId) where.customerId = customerId
        if (opportunityId) where.opportunityId = opportunityId

        const quotes = await prisma.quote.findMany({
            where,
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
            },
            orderBy: { createdAt: 'desc' }
        })

        return NextResponse.json(quotes)
    } catch (error) {
        console.error('Error fetching quotes:', error)
        return NextResponse.json({ error: 'Failed to fetch quotes' }, { status: 500 })
    }
}

export async function POST(request: Request) {
    const session = await requirePermission(request as any, PERMISSIONS.MANAGE_SALES)
    if (session instanceof NextResponse) return session

    const prisma = await getPrismaForRequest(request, session)

    try {
        const body = await request.json()
        const data = quoteSchema.parse(body)

        // Generate quote number
        const count = await prisma.quote.count()
        const quoteNumber = `COT-${String(count + 1).padStart(6, '0')}`

        const quote = await prisma.quote.create({
            data: {
                quoteNumber,
                customerId: data.customerId,
                opportunityId: data.opportunityId,
                status: data.status || 'DRAFT',
                validUntil: data.validUntil ? new Date(data.validUntil) : null,
                subtotal: data.subtotal,
                discount: data.discount || 0,
                tax: data.tax || 0,
                total: data.total,
                notes: data.notes,
                createdById: (session.user as any).id,
                items: {
                    create: data.items
                }
            },
            include: {
                customer: true,
                opportunity: true,
                items: {
                    include: {
                        product: true
                    }
                }
            }
        })

        return NextResponse.json(quote)
    } catch (error) {
        console.error('Error creating quote:', error)
        return NextResponse.json({ error: 'Failed to create quote' }, { status: 500 })
    }
}
