import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/api-middleware'
import { PERMISSIONS } from '@/lib/permissions'
import { withTenantTx, getTenantIdFromSession } from '@/lib/tenancy'
import { z } from 'zod'

const updateSchema = z.object({
    name: z.string().min(1).optional(),
    type: z.enum(['CASH', 'ELECTRONIC', 'CARD', 'TRANSFER']).optional(),
    active: z.boolean().optional(),
    config: z.string().optional().nullable(),
})

export async function PUT(
    request: Request,
    { params }: { params: { id: string } }
) {
    const session = await requirePermission(request as any, PERMISSIONS.MANAGE_SETTINGS)
    if (session instanceof NextResponse) return session

    const tenantId = getTenantIdFromSession(session)

    try {
        const body = await request.json()
        const data = updateSchema.parse(body)

        const method = await withTenantTx(tenantId, async (tx: any) => {
            return await tx.paymentMethod.update({
                where: { id: params.id },
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
    { params }: { params: { id: string } }
) {
    const session = await requirePermission(request as any, PERMISSIONS.MANAGE_SETTINGS)
    if (session instanceof NextResponse) return session

    const tenantId = getTenantIdFromSession(session)

    try {
        await withTenantTx(tenantId, async (tx: any) => {
            // Check if it's being used
            const count = await tx.payment.count({
                where: { paymentMethodId: params.id }
            })

            if (count > 0) {
                // Instead of deleting, just deactivate
                return await tx.paymentMethod.update({
                    where: { id: params.id },
                    data: { active: false }
                })
            }

            return await tx.paymentMethod.delete({
                where: { id: params.id }
            })
        })

        return NextResponse.json({ success: true })
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
