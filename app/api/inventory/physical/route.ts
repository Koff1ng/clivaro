import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/api-middleware'
import { PERMISSIONS } from '@/lib/permissions'
import { getPrismaForRequest } from '@/lib/get-tenant-prisma'
import { logger } from '@/lib/logger'
import { z } from 'zod'

const createPhysicalInventorySchema = z.object({
  warehouseId: z.string(),
  notes: z.string().optional(),
})

export async function GET(request: Request) {
  const session = await requirePermission(request as any, PERMISSIONS.MANAGE_INVENTORY)

  if (session instanceof NextResponse) {
    return session
  }

  // Obtener el cliente Prisma correcto (tenant o master según el usuario)
  const prisma = await getPrismaForRequest(request, session)

  try {
    // First, try a simple query to check if the model exists
    logger.debug('Attempting to query PhysicalInventory...')

    const { searchParams } = new URL(request.url)
    const warehouseId = searchParams.get('warehouseId')
    const status = searchParams.get('status')
    const q = searchParams.get('q')

    const where: any = {}
    if (warehouseId) {
      where.warehouseId = warehouseId
    }
    if (status) {
      where.status = status
    }
    if (q) {
      where.OR = [
        { number: { contains: q, mode: 'insensitive' } },
        { notes: { contains: q, mode: 'insensitive' } },
      ]
    }

    // Try simple query first
    const inventories = await prisma.physicalInventory.findMany({
      where,
      select: {
        id: true,
        number: true,
        warehouseId: true,
        status: true,
        createdAt: true,
        warehouse: {
          select: {
            id: true,
            name: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            name: true,
          },
        },
        _count: {
          select: {
            items: true,
          },
        },
        items: {
          select: {
            id: true,
            countedQuantity: true,
            systemQuantity: true,
            difference: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    // Calculate if there are differences for each inventory
    const inventoriesWithDifferences = inventories.map(inventory => {
      const itemsWithDifferences = inventory.items?.filter((item: any) =>
        item.countedQuantity !== null &&
        item.difference !== null &&
        item.difference !== 0
      ) || []

      const hasDifferences = itemsWithDifferences.length > 0
      const differencesCount = itemsWithDifferences.length

      // Check if there are positive differences (products added)
      const hasPositiveDifferences = itemsWithDifferences.some((item: any) => item.difference > 0)
      // Check if there are negative differences (products missing)
      const hasNegativeDifferences = itemsWithDifferences.some((item: any) => item.difference < 0)

      return {
        ...inventory,
        hasDifferences,
        differencesCount,
        hasPositiveDifferences,
        hasNegativeDifferences,
        items: undefined, // Remove items from response to reduce payload
      }
    })

    logger.debug('Physical inventories fetched', { count: inventoriesWithDifferences.length })
    return NextResponse.json({ inventories: inventoriesWithDifferences })
  } catch (error: any) {
    logger.error('Error fetching physical inventories', error, {
      endpoint: '/api/inventory/physical',
      method: 'GET',
      errorType: error?.constructor?.name,
      code: error?.code,
      meta: error?.meta,
    })

    // Check if it's a model not found error
    if (error?.message?.includes('Unknown model') || error?.message?.includes('physicalInventory')) {
      return NextResponse.json(
        {
          error: 'El modelo PhysicalInventory no existe en Prisma Client. Ejecuta: npx prisma generate',
          code: 'MODEL_NOT_FOUND',
          details: error?.message,
        },
        { status: 500 }
      )
    }

    // Check if it's a table not found error
    if (error?.message?.includes('does not exist') || error?.code === 'P2001' || error?.message?.includes('no such table')) {
      return NextResponse.json(
        {
          error: 'Las tablas de inventario físico no existen. Ejecuta la migración: npx prisma migrate dev',
          code: 'MIGRATION_REQUIRED',
          details: error?.message,
        },
        { status: 500 }
      )
    }

    return NextResponse.json(
      {
        error: 'Error al obtener inventarios físicos',
        message: error?.message || 'Error desconocido',
        code: error?.code || 'UNKNOWN',
        details: process.env.NODE_ENV === 'development' ? {
          code: error?.code,
          meta: error?.meta,
          stack: error?.stack?.split('\n').slice(0, 5),
        } : undefined,
      },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  const session = await requirePermission(request as any, PERMISSIONS.MANAGE_INVENTORY)

  if (session instanceof NextResponse) {
    return session
  }

  // Obtener el cliente Prisma correcto (tenant o master según el usuario)
  const prisma = await getPrismaForRequest(request, session)

  try {
    const body = await request.json()
    const data = createPhysicalInventorySchema.parse(body)

    // Verify warehouse exists
    const warehouse = await prisma.warehouse.findUnique({
      where: { id: data.warehouseId },
    })

    if (!warehouse) {
      return NextResponse.json(
        { error: 'Almacén no encontrado' },
        { status: 404 }
      )
    }

    // Get all products with stock in the warehouse
    const stockLevels = await prisma.stockLevel.findMany({
      where: {
        warehouseId: data.warehouseId,
        quantity: { gt: 0 },
      },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            sku: true,
            unitOfMeasure: true,
          },
        },
        variant: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    })

    logger.debug('Stock levels fetched for physical inventory', { count: stockLevels.length, warehouseId: data.warehouseId })

    // Generate inventory number
    const count = await prisma.physicalInventory.count()
    const number = `INV-${String(count + 1).padStart(6, '0')}`

    // Prepare items data including zoneId
    const itemsData = stockLevels.map(sl => ({
      productId: sl.productId,
      variantId: sl.variantId,
      zoneId: sl.zoneId,
      systemQuantity: sl.quantity,
    }))

    // Create physical inventory with items (even if empty)
    const createData: any = {
      number,
      warehouseId: data.warehouseId,
      notes: data.notes || null,
      status: 'PENDING',
      createdById: (session.user as any).id,
    }

    // Only add items if there are any
    if (itemsData.length > 0) {
      createData.items = {
        create: itemsData,
      }
    }

    const physicalInventory = await prisma.physicalInventory.create({
      data: createData,
      include: {
        warehouse: {
          select: {
            id: true,
            name: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            name: true,
          },
        },
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                sku: true,
                unitOfMeasure: true,
              },
            },
            variant: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    })

    return NextResponse.json(physicalInventory, { status: 201 })
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      logger.warn('Validation error creating physical inventory', { errors: error.errors })
      return NextResponse.json(
        { error: 'Error de validación', details: error.errors },
        { status: 400 }
      )
    }

    logger.error('Error creating physical inventory', error, {
      endpoint: '/api/inventory/physical',
      method: 'POST',
      code: error?.code,
      meta: error?.meta,
    })

    // Check if it's a table not found error
    if (error?.message?.includes('does not exist') || error?.code === 'P2001' || error?.code === 'P2025') {
      return NextResponse.json(
        {
          error: 'Las tablas de inventario físico no existen. Ejecuta la migración: npx prisma migrate dev --name add_physical_inventory',
          code: 'MIGRATION_REQUIRED',
          details: error?.message,
        },
        { status: 500 }
      )
    }

    // Check for Prisma errors
    if (error?.code) {
      let errorMessage = 'Error al crear inventario físico'
      if (error.code === 'P2002') {
        errorMessage = 'Ya existe un inventario con este número'
      } else if (error.code === 'P2003') {
        errorMessage = 'Referencia inválida (almacén o usuario no encontrado)'
      }

      return NextResponse.json(
        {
          error: errorMessage,
          code: error.code,
          details: error?.message,
          meta: process.env.NODE_ENV === 'development' ? error?.meta : undefined,
        },
        { status: 500 }
      )
    }

    return NextResponse.json(
      {
        error: 'Error al crear inventario físico',
        message: error?.message || 'Error desconocido',
        details: process.env.NODE_ENV === 'development' ? {
          stack: error?.stack,
          code: error?.code,
        } : undefined,
      },
      { status: 500 }
    )
  }
}

