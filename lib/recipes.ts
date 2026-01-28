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

/**
 * Cost breakdown for a single ingredient in a recipe
 */
export interface CostBreakdownItem {
    ingredientId: string
    ingredientName: string
    ingredientCost: number | null
    quantity: number
    totalCost: number
    isNested?: boolean
}

/**
 * Result of recipe cost calculation
 */
export interface RecipeCostResult {
    calculatedCost: number | null
    breakdown: CostBreakdownItem[]
    hasMissingCosts: boolean
    errors: string[]
}

/**
 * Calculates the cost of a product based on its recipe ingredients.
 * Handles nested recipes (PREPARED items that have their own recipes).
 * 
 * Formula: Cost per unit = SUM(ingredient.cost * quantity) / recipe.yield
 * 
 * @param prisma - Prisma client instance
 * @param productId - ID of the product to calculate cost for
 * @returns RecipeCostResult with calculated cost and breakdown
 */
export async function calculateRecipeCost(
    prisma: any,
    productId: string
): Promise<RecipeCostResult> {
    const result: RecipeCostResult = {
        calculatedCost: null,
        breakdown: [],
        hasMissingCosts: false,
        errors: []
    }

    try {
        // Fetch product with recipe
        const product = await prisma.product.findUnique({
            where: { id: productId },
            include: {
                recipe: {
                    include: {
                        items: {
                            include: {
                                ingredient: {
                                    include: {
                                        recipe: true
                                    }
                                }
                            }
                        }
                    }
                }
            }
        })

        if (!product) {
            result.errors.push('Product not found')
            return result
        }

        // If product doesn't have a recipe or isn't PREPARED, return current cost
        if (!product.recipe || product.productType !== 'PREPARED') {
            result.calculatedCost = product.cost
            return result
        }

        const recipe = product.recipe
        const recipeYield = recipe.yield || 1

        if (recipeYield <= 0) {
            result.errors.push('Recipe yield must be greater than 0')
            return result
        }

        // Track visited to prevent circular dependencies
        const visited = new Set<string>([productId])

        // Calculate cost for each ingredient
        let totalIngredientCost = 0

        for (const item of recipe.items) {
            const ingredient = item.ingredient
            let ingredientCost: number | null = null

            // Check for circular dependency
            if (visited.has(ingredient.id)) {
                result.errors.push(`Circular dependency detected: ${ingredient.name}`)
                continue
            }

            // If ingredient is PREPARED with a recipe, recursively calculate its cost
            if (ingredient.productType === 'PREPARED' && ingredient.enableRecipeConsumption && ingredient.recipe) {
                visited.add(ingredient.id)
                const nestedResult = await calculateRecipeCost(prisma, ingredient.id)
                visited.delete(ingredient.id)

                if (nestedResult.errors.length > 0) {
                    result.errors.push(...nestedResult.errors.map(e => `${ingredient.name}: ${e}`))
                }

                ingredientCost = nestedResult.calculatedCost

                // Add breakdown item for nested recipe
                result.breakdown.push({
                    ingredientId: ingredient.id,
                    ingredientName: ingredient.name,
                    ingredientCost: ingredientCost,
                    quantity: item.quantity,
                    totalCost: ingredientCost !== null ? ingredientCost * item.quantity : 0,
                    isNested: true
                })
            } else {
                // Use direct cost for RAW/RETAIL items
                ingredientCost = ingredient.cost

                result.breakdown.push({
                    ingredientId: ingredient.id,
                    ingredientName: ingredient.name,
                    ingredientCost: ingredientCost,
                    quantity: item.quantity,
                    totalCost: ingredientCost !== null ? ingredientCost * item.quantity : 0
                })
            }

            // Accumulate cost
            if (ingredientCost !== null) {
                totalIngredientCost += ingredientCost * item.quantity
            } else {
                result.hasMissingCosts = true
                result.errors.push(`Missing cost for ingredient: ${ingredient.name}`)
            }
        }

        // Calculate cost per unit (divide by yield)
        if (!result.hasMissingCosts && result.errors.length === 0) {
            result.calculatedCost = totalIngredientCost / recipeYield
        }

    } catch (error: any) {
        result.errors.push(`Error calculating cost: ${error.message}`)
    }

    return result
}
