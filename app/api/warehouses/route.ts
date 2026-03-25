import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/api-middleware'
import { PERMISSIONS } from '@/lib/permissions'
import { withTenantRead, withTenantTx } from '@/lib/tenancy'
import { z } from 'zod'

const createWarehouseSchema = z.object({
  name: z.string().min(1),
  location: z.string().optional(),
})

export async function GET(request: Request) {
  const session = await requirePermission(request as any, PERMISSIONS.MANAGE_INVENTORY)

  if (session instanceof NextResponse) {
    return session
  }

  const tenantId = (session.user as any).tenantId

  try {
    const result = await withTenantRead(tenantId, async (prisma) => {
      const warehouses = await prisma.warehouse.findMany({
        where: { active: true },
        orderBy: { name: 'asc' },
      })
      return { warehouses }
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error('Error fetching warehouses:', error)
    return NextResponse.json(
      { error: 'Failed to fetch warehouses' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  const session = await requirePermission(request as any, PERMISSIONS.MANAGE_INVENTORY)

  if (session instanceof NextResponse) {
    return session
  }

  const tenantId = (session.user as any).tenantId

  try {
    const body = await request.json()
    const data = createWarehouseSchema.parse(body)

    const warehouse = await withTenantTx(tenantId, async (prisma) => {
      return prisma.warehouse.create({
        data: {
          name: data.name,
          address: data.location || null,
          active: true,
        },
      })
    })

    return NextResponse.json(warehouse, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      )
    }
    console.error('Error creating warehouse:', error)
    return NextResponse.json(
      { error: 'Failed to create warehouse' },
      { status: 500 }
    )
  }
}
