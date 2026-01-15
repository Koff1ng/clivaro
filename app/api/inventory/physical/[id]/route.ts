import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/api-middleware'
import { PERMISSIONS } from '@/lib/permissions'
import { getPrismaForRequest } from '@/lib/get-tenant-prisma'
import { z } from 'zod'
import { updateStockLevel } from '@/lib/inventory'

const updateItemSchema = z.object({
  countedQuantity: z.number().min(0),
  notes: z.string().optional(),
})

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await requirePermission(request as any, PERMISSIONS.MANAGE_INVENTORY)
  
  if (session instanceof NextResponse) {
    return session
  }

  // Obtener el cliente Prisma correcto (tenant o master según el usuario)
  const prisma = await getPrismaForRequest(request, session)

  try {
    const inventory = await prisma.physicalInventory.findUnique({
      where: { id: params.id },
      include: {
        warehouse: {
          select: {
            id: true,
            name: true,
            address: true,
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
                barcode: true,
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
          orderBy: {
            product: {
              name: 'asc',
            },
          },
        },
      },
    })

    if (!inventory) {
      return NextResponse.json(
        { error: 'Inventario físico no encontrado' },
        { status: 404 }
      )
    }

    // Calculate differences for items with counted quantity
    const itemsWithDifference = inventory.items.map(item => ({
      ...item,
      difference: item.countedQuantity !== null
        ? item.countedQuantity - item.systemQuantity
        : null,
    }))

    return NextResponse.json({
      ...inventory,
      items: itemsWithDifference,
    })
  } catch (error) {
    console.error('Error fetching physical inventory:', error)
    return NextResponse.json(
      { error: 'Failed to fetch physical inventory' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await requirePermission(request as any, PERMISSIONS.MANAGE_INVENTORY)
  
  if (session instanceof NextResponse) {
    return session
  }

  // Obtener el cliente Prisma correcto (tenant o master según el usuario)
  const prisma = await getPrismaForRequest(request, session)

  try {
    const body = await request.json()
    const { action, itemId, ...data } = body

    const inventory = await prisma.physicalInventory.findUnique({
      where: { id: params.id },
    })

    if (!inventory) {
      return NextResponse.json(
        { error: 'Inventario físico no encontrado' },
        { status: 404 }
      )
    }

    if (action === 'start') {
      // Start counting
      const updated = await prisma.physicalInventory.update({
        where: { id: params.id },
        data: {
          status: 'COUNTING',
          startedAt: new Date(),
        },
      })
      return NextResponse.json(updated)
    }

    if (action === 'complete') {
      // Complete inventory and apply adjustments
      await prisma.$transaction(async (tx) => {
        // Get all items with counted quantities
        const items = await tx.physicalInventoryItem.findMany({
          where: {
            physicalInventoryId: params.id,
            countedQuantity: { not: null },
          },
        })

        // Calculate differences and create adjustments
        for (const item of items) {
          if (item.countedQuantity !== null) {
            const difference = item.countedQuantity - item.systemQuantity
            
            // Update difference in item
            await tx.physicalInventoryItem.update({
              where: { id: item.id },
              data: { difference },
            })

            // Create adjustment if there's a difference
            if (difference !== 0) {
              // Create stock movement
              const movementType = difference > 0 ? 'IN' : 'OUT'
              await tx.stockMovement.create({
                data: {
                  warehouseId: inventory.warehouseId,
                  productId: item.productId,
                  variantId: item.variantId,
                  type: movementType,
                  quantity: Math.abs(difference),
                  reason: `Ajuste por inventario físico ${inventory.number}`,
                  createdById: (session.user as any).id,
                  reference: inventory.number,
                },
              })

              // Update stock level
              await updateStockLevel(
                inventory.warehouseId,
                item.productId,
                item.variantId,
                difference,
                tx
              )
            }
          }
        }

        // Mark inventory as completed
        await tx.physicalInventory.update({
          where: { id: params.id },
          data: {
            status: 'COMPLETED',
            completedAt: new Date(),
          },
        })
      })

      const updated = await prisma.physicalInventory.findUnique({
        where: { id: params.id },
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
            orderBy: {
              product: {
                name: 'asc',
              },
            },
          },
        },
      })

      return NextResponse.json(updated)
    }

    if (action === 'cancel') {
      const updated = await prisma.physicalInventory.update({
        where: { id: params.id },
        data: {
          status: 'CANCELLED',
        },
      })
      return NextResponse.json(updated)
    }

    return NextResponse.json(
      { error: 'Invalid action' },
      { status: 400 }
    )
  } catch (error) {
    console.error('Error updating physical inventory:', error)
    return NextResponse.json(
      { error: 'Failed to update physical inventory' },
      { status: 500 }
    )
  }
}
