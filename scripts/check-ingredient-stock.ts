import { PrismaClient } from '@prisma/client'
import { getTenantPrisma } from '../lib/tenant-db'
import { prisma as masterPrisma } from '../lib/db'

/**
 * Verificar el stock REAL de ingredientes en "la comitiva"
 * y entender por qué los productos siguen en 0
 */
async function checkIngredientStock() {
    console.log('🔍 Verificando stock de ingredientes en La Comitiva...\n')

    try {
        const tenant = await masterPrisma.tenant.findFirst({
            where: {
                OR: [
                    { slug: 'la-comitiva' },
                    { name: { contains: 'comitiva' } }
                ]
            }
        })

        if (!tenant) {
            console.log('❌ No se encontró el tenant "la comitiva"')
            return
        }

        console.log(`✅ Tenant encontrado: ${tenant.name}\n`)

        const prisma = getTenantPrisma(tenant.databaseUrl)

        // Obtener almacenes
        const warehouses = await prisma.warehouse.findMany({
            where: { active: true }
        })

        console.log(`📦 Almacenes activos: ${warehouses.length}`)
        warehouses.forEach(w => console.log(`   - ${w.name} (${w.id})`))

        // Obtener productos con recetas
        const productsWithRecipes = await prisma.product.findMany({
            where: {
                active: true,
                enableRecipeConsumption: true,
                productType: { not: 'RAW' }
            },
            include: {
                recipe: {
                    include: {
                        items: {
                            include: {
                                ingredient: {
                                    select: {
                                        id: true,
                                        name: true,
                                        sku: true,
                                        productType: true,
                                        trackStock: true,
                                        stockLevels: {
                                            select: {
                                                warehouseId: true,
                                                quantity: true,
                                                warehouse: {
                                                    select: { name: true }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                },
                stockLevels: {
                    include: {
                        warehouse: {
                            select: { name: true }
                        }
                    }
                }
            }
        })

        console.log(`\n📋 Productos con recetas: ${productsWithRecipes.length}\n`)

        for (const product of productsWithRecipes) {
            console.log('═'.repeat(100))
            console.log(`🍔 ${product.name} (${product.sku})`)
            console.log(`   productType: ${product.productType}`)
            console.log(`   enableRecipeConsumption: ${product.enableRecipeConsumption}`)
            console.log(`   trackStock: ${product.trackStock}`)

            if (product.stockLevels.length > 0) {
                console.log(`\n   📦 Stock físico del producto:`)
                product.stockLevels.forEach(sl => {
                    console.log(`      ${sl.warehouse.name}: ${sl.quantity}`)
                })
            } else {
                console.log(`\n   📦 Stock físico: NINGUNO`)
            }

            if (!product.recipe) {
                console.log(`\n   ❌ NO TIENE RECETA (pero enableRecipeConsumption=true)`)
                continue
            }

            console.log(`\n   📝 Receta con ${product.recipe.items.length} ingredientes:`)

            for (const item of product.recipe.items) {
                if (!item.ingredient) {
                    console.log(`\n      ⚠️ Item sin ingrediente`)
                    continue
                }

                console.log(`\n      🥬 ${item.ingredient.name} (${item.ingredient.sku})`)
                console.log(`         Cantidad requerida: ${item.quantity}`)
                console.log(`         Tipo: ${item.ingredient.productType}`)
                console.log(`         trackStock: ${item.ingredient.trackStock}`)

                if (item.ingredient.stockLevels.length === 0) {
                    console.log(`         ❌ SIN STOCK EN NINGÚN ALMACÉN`)
                } else {
                    console.log(`         Stock por almacén:`)
                    item.ingredient.stockLevels.forEach(sl => {
                        const canMake = Math.floor(sl.quantity / item.quantity)
                        console.log(`            ${sl.warehouse.name}: ${sl.quantity} (puede hacer ${canMake} unidades)`)
                    })
                }
            }

            // Calcular stock virtual manualmente
            console.log(`\n   🧮 Cálculo de stock virtual:`)

            for (const warehouse of warehouses) {
                const maxQuantities = product.recipe.items.map(item => {
                    if (!item.ingredient) return 0
                    const sl = item.ingredient.stockLevels?.find(s => s.warehouseId === warehouse.id)
                    const ingredientStock = sl?.quantity || 0
                    if (item.quantity <= 0) return 0
                    return Math.floor(ingredientStock / item.quantity)
                })

                const virtualStock = maxQuantities.length > 0 ? Math.min(...maxQuantities) : 0
                console.log(`      ${warehouse.name}: ${virtualStock} unidades (min de [${maxQuantities.join(', ')}])`)
            }
        }

        console.log('\n' + '═'.repeat(100))

        // También verificar ingredientes RAW
        const rawIngredients = await prisma.product.findMany({
            where: {
                active: true,
                productType: 'RAW'
            },
            include: {
                stockLevels: {
                    include: {
                        warehouse: {
                            select: { name: true }
                        }
                    }
                }
            }
        })

        console.log(`\n🥬 INGREDIENTES (productType=RAW): ${rawIngredients.length}\n`)

        for (const ingredient of rawIngredients) {
            console.log(`   • ${ingredient.name} (${ingredient.sku})`)
            if (ingredient.stockLevels.length === 0) {
                console.log(`     ❌ SIN STOCK`)
            } else {
                ingredient.stockLevels.forEach(sl => {
                    console.log(`     ${sl.warehouse.name}: ${sl.quantity}`)
                })
            }
        }

    } catch (error: any) {
        console.error('❌ Error:', error.message)
        console.error(error.stack)
        throw error
    } finally {
        await masterPrisma.$disconnect()
    }
}

checkIngredientStock()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error)
        process.exit(1)
    })
