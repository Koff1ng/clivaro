import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/api-middleware'
import { PERMISSIONS } from '@/lib/permissions'
import { AlegraClient } from '@/lib/alegra/client'
import { logger } from '@/lib/logger'

export async function POST(request: Request) {
    const session = await requirePermission(request as any, PERMISSIONS.MANAGE_USERS)
    if (session instanceof NextResponse) return session

    try {
        const { email, token } = await request.json()

        if (!email || !token) {
            return NextResponse.json({ error: 'Email and Token are required' }, { status: 400 })
        }

        const client = new AlegraClient({ email, token })
        const company = await client.getCompany()

        return NextResponse.json({
            success: true,
            company: {
                name: company.name,
                identification: company.identification,
                email: company.email,
            }
        })
    } catch (error: any) {
        logger.error('Alegra Preflight Error', error)
        return NextResponse.json({
            success: false,
            error: error.message || 'Connection failed'
        }, { status: 400 })
    }
}
