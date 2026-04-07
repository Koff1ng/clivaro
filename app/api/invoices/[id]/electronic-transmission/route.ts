import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/api-middleware'
import { PERMISSIONS } from '@/lib/permissions'
import { withTenantRead, getTenantIdFromSession } from '@/lib/tenancy'
import { enqueueJob } from '@/lib/jobs/queue'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

export async function POST(
    request: Request,
    { params }: { params: { id: string } }
) {
    const session = await requirePermission(request as any, PERMISSIONS.MANAGE_SALES)
    if (session instanceof NextResponse) return session

    const { id: invoiceId } = params
    const tenantId = getTenantIdFromSession(session)

    try {
        const jobId = await withTenantRead(tenantId, async () => {
            return await enqueueJob('ei_send_to_alegra', {
                invoiceId,
                tenantId
            })
        })

        return NextResponse.json({ success: true, jobId })
    } catch (error: any) {
        logger.error('Failed to enqueue electronic transmission job', error)
        return NextResponse.json({ error: 'Failed to enqueue job' }, { status: 500 })
    }
}
