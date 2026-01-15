import { prisma } from './db'
import type { PrismaClient } from '@prisma/client'

// Esta función ahora requiere que se pase el cliente Prisma como parámetro
// para soportar multi-tenant

/**
 * Calculate moving average cost for a product
 * newCost = (oldCost * oldStock + receivedCost * receivedQty) / (oldStock + receivedQty)
 */
export async function updateProductCost(
  productId: string,
  warehouseId: string,
  receivedQty: number,
  receivedCost: number,
  tx?: Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>
) {
  const client = tx || prisma

  const product = await client.product.findUnique({
    where: { id: productId },
  })

  if (!product) {
    throw new Error('Product not found')
  }

  const stockLevel = await client.stockLevel.findFirst({
    where: {
      warehouseId,
      productId,
      variantId: null,
    },
  })

  const oldStock = stockLevel?.quantity || 0
  const oldCost = product.cost

  if (oldStock === 0 && receivedQty > 0) {
    // First stock entry, use received cost
    await client.product.update({
      where: { id: productId },
      data: { cost: receivedCost },
    })
    return receivedCost
  }

  if (oldStock + receivedQty === 0) {
    return oldCost
  }

  // Moving average calculation
  const numerator = oldCost * oldStock + receivedCost * receivedQty
  const denominator = oldStock + receivedQty
  const newCost = numerator / denominator

  await client.product.update({
    where: { id: productId },
    data: { cost: newCost },
  })

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
  tx?: Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>
) {
  const client = tx || prisma

  console.log(`[updateStockLevel] Actualizando stock:`, {
    warehouseId,
    productId,
    variantId,
    quantityChange,
    hasTransaction: !!tx
  })

  const whereClause: any = {
    warehouseId,
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
        productId: productId ?? null,
        variantId: variantId ?? null,
        quantity: quantityChange,
      },
    })
    console.log(`[updateStockLevel] Registro de stock creado exitosamente`)
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
  client?: Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>
): Promise<boolean> {
  const prismaClient = client || prisma
  
  const stockLevel = await prismaClient.stockLevel.findFirst({
    where: {
      warehouseId,
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
