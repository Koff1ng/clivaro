import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/api-middleware'
import { PERMISSIONS } from '@/lib/permissions'
import { getPrismaForRequest } from '@/lib/get-tenant-prisma'
import { calculateRecipeCost } from '@/lib/recipes'

/**
 * GET /api/recipes/calculate-cost?productId=xxx
 * Calculate the cost of a product based on its recipe
 */
export async function GET(request: Request) {
    const session = await requirePermission(request as any, PERMISSIONS.MANAGE_PRODUCTS)
    if (session instanceof NextResponse) return session
    const prisma = await getPrismaForRequest(request, session)

    try {
        const { searchParams } = new URL(request.url)
        const productId = searchParams.get('productId')

        if (!productId) {
            return NextResponse.json({ error: 'ProductId is required' }, { status: 400 })
        }

        const result = await calculateRecipeCost(prisma, productId)

        return NextResponse.json(result)
    } catch (error: any) {
        console.error('[Calculate Cost API] Error:', error)
        return NextResponse.json({
            error: error.message || 'Failed to calculate cost'
        }, { status: 500 })
    }
}
