import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/api-middleware'
import { PERMISSIONS } from '@/lib/permissions'
import { withTenantTx, getTenantIdFromSession } from '@/lib/tenancy'
import { z } from 'zod'

const conversionSchema = z.object({
    fromUnitId: z.string(),
    toUnitId: z.string(),
    multiplier: z.number().positive(),
})

export async function GET(request: Request) {
    const session = await requirePermission(request as any, PERMISSIONS.MANAGE_INVENTORY)
    if (session instanceof NextResponse) return session

    const tenantId = getTenantIdFromSession(session)

    try {
        const conversions = await withTenantTx(tenantId, async (tx: any) => {
            return await tx.unitConversion.findMany({
                include: {
                    fromUnit: { select: { id: true, name: true, symbol: true } },
                    toUnit: { select: { id: true, name: true, symbol: true } }
                }
            })
        })
        return NextResponse.json(conversions)
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}

export async function POST(request: Request) {
    const session = await requirePermission(request as any, PERMISSIONS.MANAGE_INVENTORY)
    if (session instanceof NextResponse) return session

    const tenantId = getTenantIdFromSession(session)

    try {
        const body = await request.json()
        const data = conversionSchema.parse(body)

        if (data.fromUnitId === data.toUnitId) {
            return NextResponse.json({ error: 'Las unidades de origen y destino deben ser diferentes' }, { status: 400 })
        }

        const conversion = await withTenantTx(tenantId, async (tx: any) => {
            // Check if units exist
            const unitsCount = await tx.unit.count({
                where: { id: { in: [data.fromUnitId, data.toUnitId] } }
            })
            if (unitsCount < 2) {
                throw new Error('Una o ambas unidades no existen')
            }

            return await tx.unitConversion.upsert({
                where: {
                    fromUnitId_toUnitId: {
                        fromUnitId: data.fromUnitId,
                        toUnitId: data.toUnitId
                    }
                },
                update: {
                    multiplier: data.multiplier
                },
                create: {
                    fromUnitId: data.fromUnitId,
                    toUnitId: data.toUnitId,
                    multiplier: data.multiplier
                }
            })
        })

        return NextResponse.json(conversion, { status: 201 })
    } catch (error: any) {
        if (error instanceof z.ZodError) {
            return NextResponse.json({ error: 'Validación fallida', details: error.errors }, { status: 400 })
        }
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
