import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/api-middleware'
import { PERMISSIONS } from '@/lib/permissions'
import { withTenantTx, getTenantIdFromSession } from '@/lib/tenancy'
import { z } from 'zod'

const zoneSchema = z.object({
    name: z.string().min(1, 'El nombre es obligatorio'),
    description: z.string().optional().nullable(),
    active: z.boolean().default(true),
})

export async function GET(
    request: Request,
    { params }: { params: { id: string } }
) {
    const session = await requirePermission(request as any, PERMISSIONS.MANAGE_INVENTORY)
    if (session instanceof NextResponse) return session

    const tenantId = getTenantIdFromSession(session)

    try {
        const zones = await withTenantTx(tenantId, async (tx) => {
            return await tx.warehouseZone.findMany({
                where: { warehouseId: params.id },
                orderBy: { name: 'asc' },
            })
        })

        return NextResponse.json(zones)
    } catch (error) {
        console.error('Error fetching zones:', error)
        return NextResponse.json({ error: 'Failed to fetch zones' }, { status: 500 })
    }
}

export async function POST(
    request: Request,
    { params }: { params: { id: string } }
) {
    const session = await requirePermission(request as any, PERMISSIONS.MANAGE_INVENTORY)
    if (session instanceof NextResponse) return session

    const tenantId = getTenantIdFromSession(session)

    try {
        const body = await request.json()
        const data = zoneSchema.parse(body)

        const zone = await withTenantTx(tenantId, async (tx) => {
            // Verificar si la bodega existe
            const warehouse = await tx.warehouse.findUnique({
                where: { id: params.id }
            })

            if (!warehouse) {
                throw new Error('Almacén no encontrado')
            }

            return await tx.warehouseZone.create({
                data: {
                    name: data.name,
                    description: data.description,
                    active: data.active,
                    warehouseId: params.id,
                },
            })
        })

        return NextResponse.json(zone, { status: 201 })
    } catch (error: any) {
        console.error('Error creating zone:', error)
        if (error instanceof z.ZodError) {
            return NextResponse.json({ error: 'Error de validación', details: error.errors }, { status: 400 })
        }
        if (error.code === 'P2002' || error.message?.includes('Unique constraint')) {
            return NextResponse.json({ error: 'Ya existe una zona con este nombre en este almacén' }, { status: 400 })
        }
        return NextResponse.json({ error: error.message || 'Failed to create zone' }, { status: 500 })
    }
}
