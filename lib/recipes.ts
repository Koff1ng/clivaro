import { PrismaClient } from '@prisma/client'

/**
 * Resolves all raw ingredients needed for a given product and quantity,
 * handling nested recipes (PREPARED items that have their own recipes).
 */
export async function resolveAllIngredients(
    prisma: any,
    productId: string,
    baseQuantity: number
) {
    const result: { ingredientId: string; quantity: number }[] = []
    const stack = [{ productId, quantity: baseQuantity }]

    // Track visited products to prevent infinite loops in malformed data
    const visited = new Set<string>()

    while (stack.length > 0) {
        const { productId: currentId, quantity: currentQty } = stack.pop()!

        if (visited.has(currentId)) {
            console.warn(`[Recipes] Circular dependency detected for product ${currentId}`)
            continue
        }
        visited.add(currentId)

        const product = await prisma.product.findUnique({
            where: { id: currentId },
            include: {
                recipe: {
                    include: {
                        items: {
                            include: {
                                ingredient: true
                            }
                        }
                    }
                }
            }
        })

        if (!product || !product.enableRecipeConsumption || !product.recipe) {
            // If it's not a recipe item, it's a leaf (RAW or RETAIL that we just deduct as is)
            // but wait, if it's the TOP level item and has no recipe, we just return the item itself.
            // However, the POS logic will call this ONLY for items that have recipes.
            result.push({ ingredientId: currentId, quantity: currentQty })
            continue
        }

        const recipe = product.recipe
        const yield_ = recipe.yield || 1
        const scale = currentQty / yield_

        for (const item of recipe.items) {
            if (item.ingredient.productType === 'PREPARED' && item.ingredient.enableRecipeConsumption) {
                // Nested recipe
                stack.push({ productId: item.ingredientId, quantity: item.quantity * scale })
            } else {
                // Raw ingredient or Retail item
                result.push({ ingredientId: item.ingredientId, quantity: item.quantity * scale })
            }
        }
    }

    // Aggregate duplicate ingredients (e.g. if two sub-recipes use the same spice)
    const aggregated = result.reduce((acc, item) => {
        acc[item.ingredientId] = (acc[item.ingredientId] || 0) + item.quantity
        return acc
    }, {} as Record<string, number>)

    return Object.entries(aggregated).map(([ingredientId, quantity]) => ({
        ingredientId,
        quantity
    }))
}
