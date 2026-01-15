import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/api-middleware'
import { PERMISSIONS } from '@/lib/permissions'
import { getPrismaForRequest } from '@/lib/get-tenant-prisma'
import { z } from 'zod'

const updateItemSchema = z.object({
  countedQuantity: z.number().min(0),
  notes: z.string().optional(),
})

export async function PUT(
  request: Request,
  { params }: { params: { id: string; itemId: string } }
) {
  const session = await requirePermission(request as any, PERMISSIONS.MANAGE_INVENTORY)
  
  if (session instanceof NextResponse) {
    return session
  }

  // Obtener el cliente Prisma correcto (tenant o master según el usuario)
  const prisma = await getPrismaForRequest(request, session)

  try {
    const body = await request.json()
    const data = updateItemSchema.parse(body)

    // Get the item to calculate difference
    const item = await prisma.physicalInventoryItem.findUnique({
      where: { id: params.itemId },
    })

    if (!item) {
      return NextResponse.json(
        { error: 'Item no encontrado' },
        { status: 404 }
      )
    }

    const difference = data.countedQuantity - item.systemQuantity

    // Update the item
    const updatedItem = await prisma.physicalInventoryItem.update({
      where: { id: params.itemId },
      data: {
        countedQuantity: data.countedQuantity,
        difference,
        notes: data.notes,
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
        physicalInventory: {
          select: {
            id: true,
            status: true,
          },
        },
      },
    })

    // If inventory is in PENDING status and this is the first item with counted quantity,
    // automatically change status to COUNTING
    if (updatedItem.physicalInventory.status === 'PENDING') {
      // Check if this is the first item with counted quantity
      const itemsWithCount = await prisma.physicalInventoryItem.count({
        where: {
          physicalInventoryId: updatedItem.physicalInventory.id,
          countedQuantity: { not: null },
        },
      })

      // If this is the first item (or one of the first), change status to COUNTING
      if (itemsWithCount > 0) {
        await prisma.physicalInventory.update({
          where: { id: updatedItem.physicalInventory.id },
          data: {
            status: 'COUNTING',
            startedAt: new Date(),
          },
        })
      }
    }

    return NextResponse.json(updatedItem)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      )
    }
    console.error('Error updating item:', error)
    return NextResponse.json(
      { error: 'Failed to update item' },
      { status: 500 }
    )
  }
}

