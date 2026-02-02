import { NextResponse } from 'next/server'
import { getPrismaForRequest } from '@/lib/get-tenant-prisma'

export async function POST(request: Request) {
    // Public endpoint, no session required essentially, but we need Prisma.
    // We'll use the master prisma or tenant prisma? 
    // Unsubscribes are ideally global OR tenant specific. 
    // Since we don't have tenant context easily in a public link without token, let's assume we pass tenantId or use a global list?
    // Current requirement: "Unsubscribe table".
    // Let's assume for now it is tenant-specific if we are tenant-based, BUT `Unsubscribe` model is in same schema.
    // We will try to infer tenant from header or body if needed, but standard schema implies single DB or per-tenant schema.
    // Assuming default prisma for now.

    // NOTE: In a real multi-tenant app, the unsubscribe link should contain a token encoding tenantId.
    // For this MVP, we will just use the available prisma client.

    const prisma = await getPrismaForRequest(request, null)

    try {
        const body = await request.json()
        const { email, reason } = body

        if (!email) {
            return NextResponse.json({ error: 'Email required' }, { status: 400 })
        }

        // Upsert to ensure idempotent
        await prisma.unsubscribe.upsert({
            where: { email },
            update: { reason },
            create: { email, reason }
        })

        return NextResponse.json({ success: true })
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
