import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { withTenantTx } from '@/lib/tenancy'

export async function POST(req: Request) {
    try {
        const session = await getServerSession(authOptions)
        if (!session || !session.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { marketingAccepted, version, ip } = await req.json()
        const userId = (session.user as any).id
        const tenantId = (session.user as any).tenantId

        if (!tenantId) {
            // Super admin acceptance can be handled in public schema
            await (prisma.user as any).update({
                where: { id: userId },
                data: {
                    legalAccepted: true,
                    legalAcceptedAt: new Date(),
                    legalVersion: version || 'v1.0 - Marzo 2026',
                    marketingAccepted: !!marketingAccepted,
                    acceptanceIp: ip || req.headers.get('x-forwarded-for') || '127.0.0.1',
                },
            })
        } else {
            // Tenant user acceptance must be in their schema
            await withTenantTx(tenantId, async (tx) => {
                await (tx.user as any).update({
                    where: { id: userId },
                    data: {
                        legalAccepted: true,
                        legalAcceptedAt: new Date(),
                        legalVersion: version || 'v1.0 - Marzo 2026',
                        marketingAccepted: !!marketingAccepted,
                        acceptanceIp: ip || req.headers.get('x-forwarded-for') || '127.0.0.1',
                    },
                })
            })
        }

        return NextResponse.json({ success: true })
    } catch (error: any) {
        console.error('[LEGAL_API] Error saving acceptance:', error)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}
