import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/api-middleware'
import { PERMISSIONS } from '@/lib/permissions'
import { getPrismaForRequest } from '@/lib/get-tenant-prisma'
import { enqueueJob } from '@/lib/jobs/queue'

export async function POST(
    request: Request,
    { params }: { params: { id: string } }
) {
    const session = await requirePermission(request as any, PERMISSIONS.MANAGE_SALES)
    if (session instanceof NextResponse) return session

    const { id: invoiceId } = params
    const { tenantId } = (session.user as any)

    try {
        const jobId = await enqueueJob('ei_send_to_alegra', {
            invoiceId,
            tenantId
        })

        return NextResponse.json({ success: true, jobId })
    } catch (error) {
        return NextResponse.json({ error: 'Failed' }, { status: 500 })
    }
}
