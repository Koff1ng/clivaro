import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { AlegraClient } from '@/lib/alegra/client'
import { logger } from '@/lib/logger'

export async function POST(request: Request) {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

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
