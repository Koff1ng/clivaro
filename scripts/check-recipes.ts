import { PrismaClient } from '@prisma/client'
import { getTenantPrisma } from '../lib/tenant-db'
import { prisma as masterPrisma } from '../lib/db'

/**
 * Verificar la configuración de recetas para productos SELLABLE
 */
async function checkRecipes() {
    console.log('🔍 Verificando configuración de recetas...\n')

    try {
        const tenants = await masterPrisma.tenant.findMany({
            where: { active: true },
            select: { id: true, name: true, slug: true, databaseUrl: true }
        })

        for (const tenant of tenants) {
            console.log('═'.repeat(100))
            console.log(`🏢 TENANT: ${tenant.name}`)
            console.log('═'.repeat(100))

            const tenantPrisma = getTenantPrisma(tenant.databaseUrl)

            // Productos SELLABLE (visibles en POS)
            const sellableProducts = await tenantPrisma.product.findMany({
                where: {
                    active: true,
                    productType: { in: ['SELLABLE', 'RETAIL'] }
                },
                include: {
                    recipe: {
                        include: {
                            items: {
                                include: {
                                    ingredient: {
                                        select: {
                                            name: true,
                                            sku: true,
                                            stockLevels: {
                                                select: {
                                                    quantity: true,
                                                    warehouse: { select: { name: true } }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    },
                    stockLevels: {
                        select: {
                            quantity: true,
                            warehouse: { select: { name: true } }
                        }
                    }
                }
            })

            console.log(`\n📊 PRODUCTOS VENDIBLES (${sellableProducts.length}):`)

            for (const product of sellableProducts) {
                console.log(`\n   • ${product.name} (${product.sku})`)
                console.log(`     Tipo: ${product.productType}`)
                console.log(`     enableRecipeConsumption: ${product.enableRecipeConsumption}`)

                const physicalStock = product.stockLevels.reduce((sum, sl) => sum + sl.quantity, 0)
                console.log(`     Stock físico: ${physicalStock}`)

                if (product.recipe) {
                    console.log(`     ✅ TIENE RECETA configurada`)
                    console.log(`     Ingredientes (${product.recipe.items.length}):`)

                    for (const item of product.recipe.items) {
                        const ingredientStock = item.ingredient?.stockLevels.reduce((sum, sl) => sum + sl.quantity, 0) || 0
                        const canMake = item.quantity > 0 ? Math.floor(ingredientStock / item.quantity) : 0
                        console.log(`       - ${item.ingredient?.name || 'N/A'}: necesita ${item.quantity}, stock: ${ingredientStock}, puede hacer: ${canMake}`)
                    }

                    // Calcular stock virtual
                    const maxQuantities = product.recipe.items.map(item => {
                        if (!item.ingredient) return 0
                        const ingredientStock = item.ingredient.stockLevels.reduce((sum, sl) => sum + sl.quantity, 0)
                        if (item.quantity <= 0) return 0
                        return Math.floor(ingredientStock / item.quantity)
                    })

                    const virtualStock = maxQuantities.length > 0 ? Math.min(...maxQuantities) : 0
                    console.log(`     📦 STOCK VIRTUAL CALCULADO: ${virtualStock}`)

                } else {
                    console.log(`     ❌ NO TIENE RECETA`)
                    if (product.enableRecipeConsumption) {
                        console.log(`     ⚠️  PROBLEMA: enableRecipeConsumption=true pero NO HAY RECETA`)
                    }
                }
            }

            console.log('\n')
        }

        console.log('═'.repeat(100))
        console.log('✅ Verificación completada')
        console.log('═'.repeat(100))

    } catch (error: any) {
        console.error('❌ Error:', error.message)
        throw error
    } finally {
        await masterPrisma.$disconnect()
    }
}

checkRecipes()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error)
        process.exit(1)
    })
