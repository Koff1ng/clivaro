import { NextResponse } from 'next/server'
import { withTenantTx } from '@/lib/tenancy'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
    try {
        const body = await request.json()
        const { email, reason, tenantId: bodyTenantId } = body

        // For public unsubscribe, we need a tenant context. 
        // Ideally the link has a token encoding this, but for now we look in the body.
        const url = new URL(request.url)
        const tenantId = bodyTenantId || url.searchParams.get('tenantId')

        if (!tenantId) {
            return NextResponse.json({ error: 'Tenant context required for unsubscribe' }, { status: 400 })
        }

        if (!email) {
            return NextResponse.json({ error: 'Email required' }, { status: 400 })
        }

        await withTenantTx(tenantId, async (prisma) => {
            await prisma.unsubscribe.upsert({
                where: { email },
                update: { reason },
                create: { email, reason }
            })
        })

        return NextResponse.json({ success: true })
    } catch (error: any) {
        logger.error('Error in unsubscribe', error)
        return NextResponse.json({ error: error.message || 'Failed to unsubscribe' }, { status: 500 })
    }
}
