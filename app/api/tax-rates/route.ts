import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/api-middleware'
import { PERMISSIONS } from '@/lib/permissions'
import { withTenantTx } from '@/lib/tenancy'
import { logger } from '@/lib/logger'
import { handleError } from '@/lib/error-handler'

export async function GET(request: Request) {
    const session = await requirePermission(request as any, PERMISSIONS.VIEW_REPORTS)
    if (session instanceof NextResponse) return session

    try {
        return await withTenantTx(session.user.tenantId, async (prisma) => {
            const taxes = await prisma.taxRate.findMany({
                where: { active: true },
                orderBy: { name: 'asc' }
            })
            return NextResponse.json(taxes)
        })
    } catch (error) {
        return handleError(error, 'GET /api/tax-rates')
    }
}

export async function POST(request: Request) {
    // Use MANAGE_SETTINGS or similar, falling back to MANAGE_PRODUCTS
    const session = await requirePermission(request as any, PERMISSIONS.MANAGE_PRODUCTS)
    if (session instanceof NextResponse) return session

    try {
        const body = await request.json()
        const { name, type, rate, description } = body

        if (!name || !type || typeof rate !== 'number') {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
        }

        return await withTenantTx(session.user.tenantId, async (prisma) => {
            const tax = await prisma.taxRate.create({
                data: {
                    name,
                    type,
                    rate,
                    description,
                    active: true
                }
            })

            logger.info(`Tax Rate created: ${name} (${rate}%)`, { tenantId: session.user.tenantId })
            return NextResponse.json(tax)
        })
    } catch (error) {
        return handleError(error, 'POST /api/tax-rates')
    }
}
