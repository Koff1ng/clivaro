import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/api-middleware'
import { PERMISSIONS } from '@/lib/permissions'
import { withTenantTx } from '@/lib/tenancy'
import { logger } from '@/lib/logger'
import { handleError } from '@/lib/error-handler'
import { z } from 'zod'

const updateTaxSchema = z.object({
    name: z.string().min(1).optional(),
    rate: z.number().min(0).optional(),
    type: z.string().optional(),
    description: z.string().optional(),
    active: z.boolean().optional(),
})

export async function PUT(
    request: Request,
    { params }: { params: { id: string } }
) {
    const session = await requirePermission(request as any, PERMISSIONS.MANAGE_PRODUCTS)
    if (session instanceof NextResponse) return session

    try {
        const body = await request.json()
        const validated = updateTaxSchema.parse(body)
        const { id } = params

        return await withTenantTx(session.user.tenantId, async (prisma) => {
            const tax = await prisma.taxRate.update({
                where: { id },
                data: validated
            })

            logger.info(`Tax Rate updated: ${tax.name} (${tax.rate}%)`, { tenantId: session.user.tenantId, taxId: id })
            return NextResponse.json(tax)
        })
    } catch (error) {
        return handleError(error, `PUT /api/tax-rates/${params.id}`)
    }
}

export async function DELETE(
    request: Request,
    { params }: { params: { id: string } }
) {
    const session = await requirePermission(request as any, PERMISSIONS.MANAGE_PRODUCTS)
    if (session instanceof NextResponse) return session

    try {
        const { id } = params

        return await withTenantTx(session.user.tenantId, async (prisma) => {
            // Soft delete
            const tax = await prisma.taxRate.update({
                where: { id },
                data: { active: false }
            })

            logger.info(`Tax Rate deleted (soft): ${tax.name}`, { tenantId: session.user.tenantId, taxId: id })
            return NextResponse.json({ success: true })
        })
    } catch (error) {
        return handleError(error, `DELETE /api/tax-rates/${params.id}`)
    }
}
