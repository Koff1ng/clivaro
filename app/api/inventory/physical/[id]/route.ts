import { NextResponse } from 'next/server'
import { logger } from '@/lib/logger'
import { requirePermission } from '@/lib/api-middleware'
import { PERMISSIONS } from '@/lib/permissions'
import { withTenantRead, withTenantTx, getTenantIdFromSession } from '@/lib/tenancy'
import { z } from 'zod'
import { logActivity } from '@/lib/activity'

export const dynamic = 'force-dynamic'
import { safeErrorMessage } from '@/lib/safe-error'

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await requirePermission(request as any, PERMISSIONS.MANAGE_INVENTORY)
  if (session instanceof NextResponse) return session

  const tenantId = getTenantIdFromSession(session)

  try {
    const inventory = await withTenantRead(tenantId, async (prisma) => {
      return await prisma.physicalInventory.findUnique({
        where: { id: params.id },
        include: {
          warehouse: { select: { id: true, name: true, address: true } },
          createdBy: { select: { id: true, name: true } },
          items: {
            include: {
              product: { select: { id: true, name: true, sku: true, barcode: true, unitOfMeasure: true } },
              variant: { select: { id: true, name: true } },
            },
            orderBy: { product: { name: 'asc' } },
          },
        },
      })
    })

    if (!inventory) return NextResponse.json({ error: 'Inventario físico no encontrado' }, { status: 404 })

    const itemsWithDifference = inventory.items.map(item => ({
      ...item,
      difference: item.countedQuantity !== null ? item.countedQuantity - item.systemQuantity : null,
    }))

    return NextResponse.json({ ...inventory, items: itemsWithDifference })
  } catch (error) {
    logger.error('Error fetching physical inventory:', error)
    return NextResponse.json({ error: 'Failed to fetch physical inventory' }, { status: 500 })
  }
}

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await requirePermission(request as any, PERMISSIONS.MANAGE_INVENTORY)
  if (session instanceof NextResponse) return session

  const tenantId = getTenantIdFromSession(session)
  const user = session.user as any

  try {
    const body = await request.json()
    const { action } = body

    const result = await withTenantTx(tenantId, async (prisma) => {
      const inventory = await prisma.physicalInventory.findUnique({ where: { id: params.id } })
      if (!inventory) throw new Error('Inventario físico no encontrado')

      if (action === 'start') {
        return await prisma.physicalInventory.update({
          where: { id: params.id },
          data: { status: 'COUNTING', startedAt: new Date() },
        })
      }

      if (action === 'complete') {
        const items = await prisma.physicalInventoryItem.findMany({
          where: { physicalInventoryId: params.id, countedQuantity: { not: null } },
        })

        for (const item of items) {
          if (item.countedQuantity !== null) {
            const difference = item.countedQuantity - item.systemQuantity
            await prisma.physicalInventoryItem.update({
              where: { id: item.id },
              data: { difference },
            })
          }
        }

        const updated = await prisma.physicalInventory.update({
          where: { id: params.id },
          data: { status: 'COMPLETED', completedAt: new Date() },
        })

        await logActivity({
          prisma,
          type: 'INVENTORY_PHYSICAL',
          subject: `Inventario Físico Finalizado (Pendiente Aprobación): ${inventory.number}`,
          description: `Se finalizaron los conteos para ${items.length} productos.`,
          userId: user.id,
          metadata: { inventoryId: inventory.id, warehouseId: inventory.warehouseId }
        })

        return await prisma.physicalInventory.findUnique({
          where: { id: params.id },
          include: {
            warehouse: { select: { id: true, name: true } },
            createdBy: { select: { id: true, name: true } },
            items: {
              include: {
                product: { select: { id: true, name: true, sku: true, unitOfMeasure: true } },
                variant: { select: { id: true, name: true } },
                zone: { select: { id: true, name: true } },
              },
              orderBy: { product: { name: 'asc' } },
            },
          },
        })
      }

      if (action === 'cancel') {
        return await prisma.physicalInventory.update({
          where: { id: params.id },
          data: { status: 'CANCELLED' },
        })
      }

      throw new Error('Invalid action')
    })

    return NextResponse.json(result)
  } catch (error: any) {
    if (error.message === 'Inventario físico no encontrado') {
      return NextResponse.json({ error: safeErrorMessage(error) }, { status: 404 })
    }
    if (error.message === 'Invalid action') {
      return NextResponse.json({ error: safeErrorMessage(error) }, { status: 400 })
    }
    logger.error('Error updating physical inventory:', error)
    return NextResponse.json({ error: 'Failed to update physical inventory' }, { status: 500 })
  }
}
