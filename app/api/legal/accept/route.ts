import { NextResponse } from 'next/server'
import { logger } from '@/lib/logger'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma as masterPrisma } from '@/lib/db'
import { withTenantTx, getTenantIdFromSession } from '@/lib/tenancy'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const tenantId = (session.user as any).tenantId
        const userId = (session.user as any).id
        const { marketingAccepted, version, ip } = await req.json()
        const clientIp = ip || req.headers.get('x-forwarded-for') || '127.0.0.1'

        const updateData = {
            legalAccepted: true,
            legalAcceptedAt: new Date(),
            legalVersion: version || 'v1.0 - Marzo 2026',
            marketingAccepted: !!marketingAccepted,
            acceptanceIp: clientIp,
        }

        if (!tenantId) {
            // Super admin acceptance in public schema
            await masterPrisma.user.update({
                where: { id: userId },
                data: updateData as any,
            })
        } else {
            // Tenant user acceptance in their schema
            await withTenantTx(tenantId, async (tx) => {
                await (tx as any).user.update({
                    where: { id: userId },
                    data: updateData as any,
                })
            })
        }

        return NextResponse.json({ success: true })
    } catch (error: any) {
        logger.error('[LEGAL_API] Error saving acceptance:', error)
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 })
    }
}
