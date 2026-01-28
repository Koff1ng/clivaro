import { NextResponse } from 'next/server'
import { requireAnyPermission } from '@/lib/api-middleware'
import { PERMISSIONS } from '@/lib/permissions'
import { getPrismaForRequest } from '@/lib/get-tenant-prisma'

export async function GET(request: Request) {
  // Allow MANAGE_INVENTORY, MANAGE_SALES (for POS), or MANAGE_PRODUCTS
  const session = await requireAnyPermission(request as any, [PERMISSIONS.MANAGE_INVENTORY, PERMISSIONS.MANAGE_SALES, PERMISSIONS.MANAGE_PRODUCTS])

  if (session instanceof NextResponse) {
    return session
  }

  // Obtener el cliente Prisma correcto (tenant o master según el usuario)
  const prisma = await getPrismaForRequest(request, session)

  try {
    const warehouses = await prisma.warehouse.findMany({
      where: { active: true },
      orderBy: { name: 'asc' },
    })

    return NextResponse.json(warehouses)
  } catch (error) {
    console.error('Error fetching warehouses:', error)
    return NextResponse.json(
      { error: 'Failed to fetch warehouses' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  const session = await requireAnyPermission(request as any, [PERMISSIONS.MANAGE_INVENTORY, PERMISSIONS.MANAGE_PRODUCTS])

  if (session instanceof NextResponse) {
    return session
  }

  const prisma = await getPrismaForRequest(request, session)

  try {
    const body = await request.json()
    const { name, address, active } = body

    if (!name) {
      return NextResponse.json({ error: 'El nombre es obligatorio' }, { status: 400 })
    }

    const warehouse = await prisma.warehouse.create({
      data: {
        name,
        address: address || null,
        active: active !== undefined ? active : true,
      },
    })

    return NextResponse.json(warehouse, { status: 201 })
  } catch (error: any) {
    console.error('Error creating warehouse:', error)
    if (error.code === 'P2002') {
      return NextResponse.json({ error: 'Ya existe un almacén con este nombre' }, { status: 400 })
    }
    return NextResponse.json(
      { error: 'Error al crear el almacén' },
      { status: 500 }
    )
  }
}
