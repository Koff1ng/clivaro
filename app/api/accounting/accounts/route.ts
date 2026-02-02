import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/api-middleware'
import { PERMISSIONS } from '@/lib/permissions'
import { getPrismaForRequest } from '@/lib/get-tenant-prisma'
import { z } from 'zod'

const accountSchema = z.object({
    code: z.string().min(1),
    name: z.string().min(1),
    type: z.enum(['ASSET', 'LIABILITY', 'EQUITY', 'INCOME', 'EXPENSE']),
    parentAccountId: z.string().optional().nullable(),
})

export async function GET(request: Request) {
    // Reusing MANAGE_CRM for now as placeholder for accounting permission
    const session = await requirePermission(request as any, PERMISSIONS.MANAGE_CRM)

    if (session instanceof NextResponse) {
        return session
    }

    const prisma = await getPrismaForRequest(request, session)

    try {
        const accounts = await prisma.accountingAccount.findMany({
            orderBy: { code: 'asc' },
            include: {
                parentAccount: {
                    select: { code: true, name: true }
                }
            }
        })

        return NextResponse.json(accounts)
    } catch (error) {
        console.error('Error fetching accounts:', error)
        return NextResponse.json({ error: 'Failed to fetch accounts' }, { status: 500 })
    }
}

export async function POST(request: Request) {
    const session = await requirePermission(request as any, PERMISSIONS.MANAGE_CRM)

    if (session instanceof NextResponse) {
        return session
    }

    const prisma = await getPrismaForRequest(request, session)

    try {
        const body = await request.json()
        const data = accountSchema.parse(body)

        const account = await prisma.accountingAccount.create({
            data: {
                code: data.code,
                name: data.name,
                type: data.type,
                parentAccountId: data.parentAccountId || null,
                active: true
            }
        })

        return NextResponse.json(account, { status: 201 })
    } catch (error: any) {
        if (error instanceof z.ZodError) {
            return NextResponse.json({ error: 'Validation error', details: error.errors }, { status: 400 })
        }
        // Handle unique code violation
        if (error.code === 'P2002') {
            return NextResponse.json({ error: 'Account code already exists' }, { status: 409 })
        }
        console.error('Error creating account:', error)
        return NextResponse.json({ error: 'Failed to create account', details: error.message }, { status: 500 })
    }
}
