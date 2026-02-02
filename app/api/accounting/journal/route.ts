import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/api-middleware'
import { PERMISSIONS } from '@/lib/permissions'
import { getPrismaForRequest } from '@/lib/get-tenant-prisma'
import { z } from 'zod'

const journalLineSchema = z.object({
    accountId: z.string().min(1),
    description: z.string().optional(),
    debit: z.number().min(0).default(0),
    credit: z.number().min(0).default(0),
})

const journalEntrySchema = z.object({
    date: z.string(), // ISO Date
    description: z.string().min(1),
    reference: z.string().optional(),
    status: z.enum(['DRAFT', 'POSTED']).default('DRAFT'),
    lines: z.array(journalLineSchema).min(2),
})

export async function GET(request: Request) {
    const session = await requirePermission(request as any, PERMISSIONS.MANAGE_CRM) // Todo: dedicated permission
    if (session instanceof NextResponse) return session
    const prisma = await getPrismaForRequest(request, session)

    try {
        const { searchParams } = new URL(request.url)
        const startDate = searchParams.get('startDate')
        const endDate = searchParams.get('endDate')

        const where: any = {}
        if (startDate && endDate) {
            where.date = {
                gte: new Date(startDate),
                lte: new Date(endDate)
            }
        }

        const entries = await prisma.journalEntry.findMany({
            where,
            include: {
                lines: {
                    include: {
                        account: {
                            select: { code: true, name: true }
                        }
                    }
                },
                createdBy: {
                    select: { name: true }
                }
            },
            orderBy: { date: 'desc' },
            take: 100 // Limit for safety
        })

        return NextResponse.json(entries)
    } catch (error) {
        console.error('Error fetching journal:', error)
        return NextResponse.json({ error: 'Failed to fetch journal' }, { status: 500 })
    }
}

export async function POST(request: Request) {
    const session = await requirePermission(request as any, PERMISSIONS.MANAGE_CRM)
    if (session instanceof NextResponse) return session
    const prisma = await getPrismaForRequest(request, session)

    try {
        const body = await request.json()
        const data = journalEntrySchema.parse(body)

        // Validate Balance (Debits == Credits)
        const totalDebit = data.lines.reduce((sum, line) => sum + line.debit, 0)
        const totalCredit = data.lines.reduce((sum, line) => sum + line.credit, 0)

        if (Math.abs(totalDebit - totalCredit) > 0.01) { // Allowing small float precision diff
            return NextResponse.json({
                error: 'Unbalanced Journal Entry',
                details: `Debits (${totalDebit}) do not equal Credits (${totalCredit})`
            }, { status: 400 })
        }

        const entry = await prisma.journalEntry.create({
            data: {
                date: new Date(data.date),
                description: data.description,
                reference: data.reference,
                status: data.status,
                createdById: (session.user as any).id,
                lines: {
                    create: data.lines.map(line => ({
                        accountId: line.accountId,
                        description: line.description,
                        debit: line.debit,
                        credit: line.credit
                    }))
                }
            },
            include: {
                lines: true
            }
        })

        return NextResponse.json(entry, { status: 201 })
    } catch (error: any) {
        if (error instanceof z.ZodError) {
            return NextResponse.json({ error: 'Validation error', details: error.errors }, { status: 400 })
        }
        console.error('Error creating journal entry:', error)
        return NextResponse.json({ error: 'Failed to create entry' }, { status: 500 })
    }
}
