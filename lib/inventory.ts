import { prisma } from './db'
import type { PrismaClient } from '@prisma/client'

// Esta función ahora requiere que se pase el cliente Prisma como parámetro
// para soportar multi-tenant

/**
 * Calculate moving average cost for a product
 * newCost = (oldCost * oldStock + receivedCost * receivedQty) / (oldStock + receivedQty)
 */
/**
 * Calculate moving average cost for a product or variant
 * newCost = (oldCost * oldStock + receivedCost * receivedQty) / (oldStock + receivedQty)
 */
export async function updateProductCost(
  productId: string,
  warehouseId: string,
  receivedQty: number,
  receivedCost: number,
  tx?: any,
  variantId?: string | null
) {
  const client = tx || prisma

  // 1. Get current cost from Product or Variant
  let oldCost = 0
  if (variantId) {
    const variant = await client.productVariant.findUnique({
      where: { id: variantId },
    })
    oldCost = variant?.cost || 0
  } else {
    const product = await client.product.findUnique({
      where: { id: productId },
    })
    if (!product) throw new Error('Product not found')
    oldCost = product.cost || 0
  }

  // 2. Get current stock level
  const stockLevel = await client.stockLevel.findFirst({
    where: {
      warehouseId,
      productId,
      variantId: variantId || null,
    },
  })

  const oldStock = stockLevel?.quantity || 0

  // 3. WAC Logic
  let newCost = oldCost

  if (oldStock <= 0) {
    // If stock was negative or zero, the new cost is the received cost
    newCost = receivedCost
  } else if (oldStock + receivedQty > 0) {
    // Standard Moving Average Calculation
    const totalOldValue = oldCost * oldStock
    const totalNewValue = receivedCost * receivedQty
    newCost = (totalOldValue + totalNewValue) / (oldStock + receivedQty)
  }

  // Ensure newCost isn't negative or NaN
  newCost = isNaN(newCost) ? receivedCost : Math.max(0, newCost)

  // 4. Update cost
  if (variantId) {
    await client.productVariant.update({
      where: { id: variantId },
      data: { cost: newCost },
    })
  } else {
    await client.product.update({
      where: { id: productId },
      data: { cost: newCost },
    })
  }

  return newCost
}

/**
 * Update stock level (create or update)
 */
export async function updateStockLevel(
  warehouseId: string,
  productId: string | null,
  variantId: string | null,
  quantityChange: number,
  prismaTx?: any,
  movementDetails?: {
    type: 'IN' | 'OUT' | 'ADJUSTMENT' | 'TRANSFER'
    zoneId?: string
    reason?: string
    reasonCode?: string
    reference?: string
    createdById?: string
  }
) {
  const client = prismaTx || prisma
  const zoneId = movementDetails?.zoneId || null

  console.log(`[updateStockLevel] Actualizando stock:`, {
    warehouseId,
    zoneId,
    productId,
    variantId,
    quantityChange,
    hasTransaction: !!prismaTx
  })

  const whereClause: any = {
    warehouseId,
    zoneId,
    productId: productId ?? null,
    variantId: variantId ?? null,
  }

  const existing = await client.stockLevel.findFirst({
    where: whereClause,
  })

  console.log(`[updateStockLevel] Stock existente:`, existing ? { id: existing.id, quantity: existing.quantity } : 'No existe')

  if (existing) {
    const newQuantity = existing.quantity + quantityChange
    console.log(`[updateStockLevel] Actualizando stock: ${existing.quantity} + ${quantityChange} = ${newQuantity}`)
    await client.stockLevel.update({
      where: { id: existing.id },
      data: { quantity: newQuantity },
    })
    console.log(`[updateStockLevel] Stock actualizado exitosamente`)
  } else {
    console.log(`[updateStockLevel] Creando nuevo registro de stock con cantidad: ${quantityChange}`)
    await client.stockLevel.create({
      data: {
        warehouseId,
        zoneId,
        productId: productId ?? null,
        variantId: variantId ?? null,
        quantity: quantityChange,
      },
    })
    console.log(`[updateStockLevel] Registro de stock creado exitosamente`)
  }

  // Create movement if details provided
  if (movementDetails) {
    await client.stockMovement.create({
      data: {
        warehouseId,
        zoneId,
        productId,
        variantId,
        type: movementDetails.type,
        quantity: Math.abs(quantityChange),
        reason: movementDetails.reason,
        reasonCode: movementDetails.reasonCode,
        reference: movementDetails.reference,
        createdById: movementDetails.createdById || 'SYSTEM',
      }
    })
  }
}

/**
 * Check if product has sufficient stock
 * @param client - Prisma client (tenant or master)
 */
export async function checkStock(
  warehouseId: string,
  productId: string,
  variantId: string | null,
  requiredQty: number,
  client?: Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>,
  zoneId?: string
): Promise<boolean> {
  const prismaClient = client || prisma

  const stockLevel = await prismaClient.stockLevel.findFirst({
    where: {
      warehouseId,
      zoneId: zoneId ?? null,
      productId,
      variantId: variantId ?? null,
    },
  })

  // Si no hay registro de stock, retornar false (no hay stock disponible)
  if (!stockLevel) {
    return false
  }

  return stockLevel.quantity >= requiredQty
}
