import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/api-middleware'
import { PERMISSIONS } from '@/lib/permissions'
import { withTenantRead, withTenantTx } from '@/lib/tenancy'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const unitSchema = z.object({
    name: z.string().min(1),
    symbol: z.string().min(1),
})

export async function GET(request: Request) {
    const session = await requirePermission(request as any, PERMISSIONS.MANAGE_PRODUCTS)
    if (session instanceof NextResponse) return session

    const tenantId = (session.user as any).tenantId

    try {
        const result = await withTenantRead(tenantId, async (prisma) => {
            return await prisma.unit.findMany({
                orderBy: { name: 'asc' }
            })
        })
        return NextResponse.json(result)
    } catch (error) {
        return NextResponse.json({ error: 'Failed to fetch units' }, { status: 500 })
    }
}

export async function POST(request: Request) {
    const session = await requirePermission(request as any, PERMISSIONS.MANAGE_PRODUCTS)
    if (session instanceof NextResponse) return session

    const tenantId = (session.user as any).tenantId

    try {
        const body = await request.json()
        const data = unitSchema.parse(body)

        const unit = await withTenantTx(tenantId, async (prisma) => {
            return await prisma.unit.create({
                data: {
                    name: data.name,
                    symbol: data.symbol,
                }
            })
        })
        return NextResponse.json(unit, { status: 201 })
    } catch (error: any) {
        if (error.code === 'P2002') {
            return NextResponse.json({ error: 'Ya existe una unidad con ese nombre' }, { status: 400 })
        }
        return NextResponse.json({ error: error.message || 'Failed to create unit' }, { status: 500 })
    }
}
