import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/api-middleware'
import { PERMISSIONS } from '@/lib/permissions'
import { withTenantTx, getTenantIdFromSession } from '@/lib/tenancy'
import { z } from 'zod'

const updateSchema = z.object({
    name: z.string().min(1).optional(),
    type: z.enum(['CASH', 'ELECTRONIC', 'CARD', 'TRANSFER', 'CREDIT']).optional(),
    active: z.boolean().optional(),
    color: z.string().nullable().optional(),
    icon: z.string().nullable().optional(),
    config: z.string().optional().nullable(),
})

export async function PUT(
    request: Request,
    { params }: { params: { id: string } | Promise<{ id: string }> }
) {
    const resolvedParams = await Promise.resolve(params)
    const session = await requirePermission(request as any, PERMISSIONS.MANAGE_SETTINGS)
    if (session instanceof NextResponse) return session

    const tenantId = getTenantIdFromSession(session)

    try {
        const body = await request.json()
        const data = updateSchema.parse(body)

        const method = await withTenantTx(tenantId, async (tx: any) => {
            return await tx.paymentMethod.update({
                where: { id: resolvedParams.id },
                data
            })
        })

        return NextResponse.json(method)
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}

export async function DELETE(
    request: Request,
    { params }: { params: { id: string } | Promise<{ id: string }> }
) {
    const resolvedParams = await Promise.resolve(params)
    const session = await requirePermission(request as any, PERMISSIONS.MANAGE_SETTINGS)
    if (session instanceof NextResponse) return session

    const tenantId = getTenantIdFromSession(session)

    try {
        await withTenantTx(tenantId, async (tx: any) => {
            // Check if it's being used in payments
            const paymentCount = await tx.payment.count({
                where: { paymentMethodId: resolvedParams.id }
            })

            // Check if it's being used in shift summaries
            const shiftCount = await tx.shiftSummary.count({
                where: { paymentMethodId: resolvedParams.id }
            })

            if (paymentCount > 0 || shiftCount > 0) {
                // Instead of deleting, just deactivate (has historical references)
                return await tx.paymentMethod.update({
                    where: { id: resolvedParams.id },
                    data: { active: false }
                })
            }

            return await tx.paymentMethod.delete({
                where: { id: resolvedParams.id }
            })
        })

        return NextResponse.json({ success: true })
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}

