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

        const userId = (session.user as any).id
        const tenantId = (session.user as any).tenantId

        if (!tenantId) {
            await (prisma.user as any).update({
                where: { id: userId },
                data: { marketingAccepted: false },
            })
        } else {
            await withTenantTx(tenantId, async (tx) => {
                await (tx.user as any).update({
                    where: { id: userId },
                    data: { marketingAccepted: false },
                })
            })
        }

        return NextResponse.json({ success: true })
    } catch (error: any) {
        console.error('[LEGAL_API] Error revoking marketing:', error)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}
