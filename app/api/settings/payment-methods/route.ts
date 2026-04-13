import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/api-middleware'
import { PERMISSIONS } from '@/lib/permissions'
import { withTenantTx, getTenantIdFromSession } from '@/lib/tenancy'
import { z } from 'zod'

export const dynamic = 'force-dynamic'
import { safeErrorMessage } from '@/lib/safe-error'

const paymentMethodSchema = z.object({
    name: z.string().min(1),
    type: z.enum(['CASH', 'ELECTRONIC', 'CARD', 'TRANSFER', 'CREDIT']).default('ELECTRONIC'),
    dianCode: z.string().default('ZZZ'),
    active: z.boolean().default(true),
    color: z.string().nullable().optional(),
    icon: z.string().nullable().optional(),
    config: z.string().optional().nullable(),
})

export async function GET(request: Request) {
    const session = await requirePermission(request as any, PERMISSIONS.MANAGE_SETTINGS)
    if (session instanceof NextResponse) return session

    const tenantId = getTenantIdFromSession(session)

    try {
        const methods = await withTenantTx(tenantId, async (tx: any) => {
            return await tx.paymentMethod.findMany({
                orderBy: { name: 'asc' }
            })
        })
        return NextResponse.json(methods)
    } catch (error: any) {
        return NextResponse.json({ error: safeErrorMessage(error) }, { status: 500 })
    }
}

export async function POST(request: Request) {
    const session = await requirePermission(request as any, PERMISSIONS.MANAGE_SETTINGS)
    if (session instanceof NextResponse) return session

    const tenantId = getTenantIdFromSession(session)

    try {
        const body = await request.json()
        const data = paymentMethodSchema.parse(body)

        const method = await withTenantTx(tenantId, async (tx: any) => {
            return await tx.paymentMethod.create({
                data: {
                    name: data.name,
                    type: data.type,
                    dianCode: data.dianCode,
                    active: data.active,
                    color: data.color,
                    icon: data.icon,
                    config: data.config,
                }
            })
        })

        return NextResponse.json(method, { status: 201 })
    } catch (error: any) {
        if (error instanceof z.ZodError) {
            return NextResponse.json({ error: 'Validación fallida', details: error.errors }, { status: 400 })
        }
        return NextResponse.json({ error: safeErrorMessage(error) }, { status: 500 })
    }
}
