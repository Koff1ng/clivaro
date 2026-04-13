import { NextResponse } from 'next/server'
import { logger } from '@/lib/logger'
import { requirePermission } from '@/lib/api-middleware'
import { PERMISSIONS } from '@/lib/permissions'
import { withTenantRead, getTenantIdFromSession } from '@/lib/tenancy'
import { calculateRecipeCost } from '@/lib/recipes'

export const dynamic = 'force-dynamic'
import { safeErrorMessage } from '@/lib/safe-error'

/**
 * GET /api/recipes/calculate-cost?productId=xxx
 * Calculate the cost of a product based on its recipe
 */
export async function GET(request: Request) {
    const session = await requirePermission(request as any, PERMISSIONS.MANAGE_PRODUCTS)
    if (session instanceof NextResponse) return session

    const tenantId = getTenantIdFromSession(session)

    try {
        const { searchParams } = new URL(request.url)
        const productId = searchParams.get('productId')

        if (!productId) {
            return NextResponse.json({ error: 'ProductId is required' }, { status: 400 })
        }

        const result = await withTenantRead(tenantId, async (prisma) => {
            return await calculateRecipeCost(prisma, productId)
        })

        return NextResponse.json(result)
    } catch (error: any) {
        logger.error('[Calculate Cost API] Error:', error)
        return NextResponse.json({
            error: safeErrorMessage(error, 'Failed to calculate cost')
        }, { status: 500 })
    }
}
