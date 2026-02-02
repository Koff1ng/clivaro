import { prisma } from './db'

/**
 * Converts a quantity from one unit to another.
 * Looks for direct conversions or reciprocal ones.
 */
export async function convertQuantity(
    quantity: number,
    fromUnitId: string,
    toUnitId: string,
    prismaClient?: any
): Promise<number> {
    if (fromUnitId === toUnitId) return quantity

    const db = prismaClient || prisma

    // Try direct conversion
    const direct = await db.unitConversion.findFirst({
        where: { fromUnitId, toUnitId }
    })

    if (direct) {
        return quantity * direct.multiplier
    }

    // Try reciprocal conversion
    const reciprocal = await db.unitConversion.findFirst({
        where: { fromUnitId: toUnitId, toUnitId: fromUnitId }
    })

    if (reciprocal) {
        return quantity / reciprocal.multiplier
    }

    // If no direct conversion, we could try chaining (e.g. A -> B -> C)
    // For now, let's keep it simple and throw error if not found
    throw new Error(`No se encontró conversión válida entre las unidades especificadas.`)
}
