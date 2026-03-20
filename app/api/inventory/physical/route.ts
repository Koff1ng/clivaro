import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/api-middleware'
import { PERMISSIONS } from '@/lib/permissions'
import { withTenantRead, withTenantTx, getTenantIdFromSession } from '@/lib/tenancy'
import { z } from 'zod'
import { logActivity } from '@/lib/activity'
import { handleError } from '@/lib/error-handler'

const createPhysicalInventorySchema = z.object({
  warehouseId: z.string().min(1),
  notes: z.string().optional(),
  categoryIds: z.array(z.string()).optional(),
  brandIds: z.array(z.string()).optional(),
})

export async function GET(request: Request) {
  const session = await requirePermission(request as any, PERMISSIONS.MANAGE_INVENTORY)
  if (session instanceof NextResponse) return session

  const tenantId = getTenantIdFromSession(session)

  try {
    const { searchParams } = new URL(request.url)
    const warehouseId = searchParams.get('warehouseId')
    const status = searchParams.get('status')
    const q = searchParams.get('q')

    const result = await withTenantRead(tenantId, async (prisma) => {
      const where: any = {}
      if (warehouseId) where.warehouseId = warehouseId
      if (status) where.status = status
      if (q) {
        where.OR = [
          { number: { contains: q, mode: 'insensitive' } },
          { notes: { contains: q, mode: 'insensitive' } },
        ]
      }

      const inventories = await prisma.physicalInventory.findMany({
        where,
        include: {
          warehouse: { select: { id: true, name: true } },
          createdBy: { select: { id: true, name: true } },
          _count: { select: { items: true } },
          items: {
            select: {
              id: true,
              countedQuantity: true,
              systemQuantity: true,
              difference: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      })

      return inventories.map(inventory => {
        const itemsWithDifferences = inventory.items?.filter((item: any) =>
          item.countedQuantity !== null && item.difference !== null && item.difference !== 0
        ) || []

        return {
          ...inventory,
          hasDifferences: itemsWithDifferences.length > 0,
          differencesCount: itemsWithDifferences.length,
          hasPositiveDifferences: itemsWithDifferences.some((item: any) => item.difference > 0),
          hasNegativeDifferences: itemsWithDifferences.some((item: any) => item.difference < 0),
          items: undefined,
        }
      })
    })

    return NextResponse.json({ inventories: result })
  } catch (error: unknown) {
    return handleError(error, 'PHYSICAL_INVENTORY_GET')
  }
}

export async function POST(request: Request) {
  const session = await requirePermission(request as any, PERMISSIONS.MANAGE_INVENTORY)
  if (session instanceof NextResponse) return session

  const tenantId = getTenantIdFromSession(session)
  const user = session.user as any

  try {
    const body = await request.json()
    const result = await withTenantTx(tenantId, async (prisma) => {
      const parsed = createPhysicalInventorySchema.safeParse(body)
      if (!parsed.success) {
        return { error: 'Validation error', details: parsed.error.flatten(), status: 400 }
      }
      const data = parsed.data

      const warehouse = await prisma.warehouse.findUnique({ where: { id: data.warehouseId } })
      if (!warehouse) throw new Error('Warehouse not found')

      const count = await prisma.physicalInventory.count()
      const number = `INV-${(count + 1).toString().padStart(6, '0')}`

      const inventory = await prisma.physicalInventory.create({
        data: {
          number,
          warehouseId: data.warehouseId,
          status: 'PENDING',
          notes: data.notes || null,
          createdById: user.id,
        },
      })

      const stockLevels = await prisma.stockLevel.findMany({
        where: { 
          warehouseId: data.warehouseId, 
          product: {
            trackStock: true,
            ...(data.categoryIds && data.categoryIds.length > 0 ? { categoryId: { in: data.categoryIds } } : {}),
            ...(data.brandIds && data.brandIds.length > 0 ? { brandId: { in: data.brandIds } } : {}),
          }
        },
        include: {
          product: { select: { id: true, name: true, sku: true, unitOfMeasure: true } },
          variant: { select: { id: true, name: true } },
        },
      })

      const itemsData = stockLevels.map(sl => ({
        physicalInventoryId: inventory.id,
        productId: sl.productId,
        variantId: sl.variantId,
        zoneId: sl.zoneId,
        systemQuantity: sl.quantity,
      }))

      if (itemsData.length > 0) {
        await prisma.physicalInventoryItem.createMany({ data: itemsData })
      }

      await logActivity({
        prisma,
        type: 'INVENTORY_PHYSICAL',
        subject: `Nuevo Inventario Físico: ${number}`,
        description: `Se inició un inventario físico para ${itemsData.length} productos en ${warehouse.name}.`,
        userId: user.id,
        metadata: { inventoryId: inventory.id, warehouseId: warehouse.id }
      })

      return await prisma.physicalInventory.findUnique({
        where: { id: inventory.id },
        include: {
          warehouse: { select: { id: true, name: true } },
          createdBy: { select: { id: true, name: true } },
          items: {
            include: {
              product: { select: { id: true, name: true, sku: true, unitOfMeasure: true } },
              variant: { select: { id: true, name: true } },
            },
          },
        },
      })
    })

    if (result && typeof result === 'object' && 'error' in result) {
      return NextResponse.json({ error: (result as any).error, details: (result as any).details }, { status: (result as any).status })
    }

    if (!result) {
      return NextResponse.json({ error: 'Failed to create physical inventory' }, { status: 500 })
    }

    return NextResponse.json(result, { status: 201 })
  } catch (error: unknown) {
    return handleError(error, 'PHYSICAL_INVENTORY_POST')
  }
}
