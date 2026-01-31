import { PrismaClient } from '@prisma/client'
import { getTenantPrisma } from '../lib/tenant-db'
import { prisma as masterPrisma } from '../lib/db'

/**
 * Simula EXACTAMENTE lo que hace /api/pos/products
 * para ver qué está retornando
 */
async function simulatePOSAPI() {
    console.log('🔍 Simulando /api/pos/products...\n')

    try {
        const tenants = await masterPrisma.tenant.findMany({
            where: { active: true },
            select: { id: true, name: true, slug: true, databaseUrl: true }
        })

        for (const tenant of tenants) {
            console.log('═'.repeat(100))
            console.log(`🏢 TENANT: ${tenant.name}`)
            console.log('═'.repeat(100))

            const prisma = getTenantPrisma(tenant.databaseUrl)

            // Fetch all active warehouses (matching the API)
            const allWarehouses = await prisma.warehouse.findMany({
                where: { active: true },
                select: { id: true }
            })
            const allWarehouseIds = allWarehouses.map(w => w.id)

            console.log(`\n📦 Almacenes activos: ${allWarehouseIds.length}`)
            console.log(`   IDs: ${allWarehouseIds.join(', ')}\n`)

            // EXACTAMENTE la misma query que el API
            const where: any = {
                active: true,
                productType: { not: 'RAW' },
            }

            const productsRaw = await prisma.product.findMany({
                where,
                take: 100,
                orderBy: { name: 'asc' },
                include: {
                    stockLevels: {
                        select: {
                            warehouseId: true,
                            quantity: true,
                        },
                    },
                    recipe: {
                        include: {
                            items: {
                                include: {
                                    ingredient: {
                                        select: {
                                            id: true,
                                            stockLevels: {
                                                select: { quantity: true, warehouseId: true }
                                            },
                                        }
                                    }
                                }
                            }
                        }
                    }
                } as any,
            })

            console.log(`\n📦 Productos obtenidos de DB: ${productsRaw.length}\n`)

            // EXACTAMENTE el mismo procesamiento que el API
            const products = productsRaw.map((p: any) => {
                let stockLevels = p.stockLevels || []

                console.log(`\n🔸 ${p.name} (${p.sku})`)
                console.log(`   productType: ${p.productType}`)
                console.log(`   enableRecipeConsumption: ${p.enableRecipeConsumption}`)
                console.log(`   Tiene receta: ${p.recipe ? 'SÍ' : 'NO'}`)
                console.log(`   Items en receta: ${p.recipe?.items?.length || 0}`)
                console.log(`   Stock físico inicial: ${JSON.stringify(stockLevels)}`)

                if (p.enableRecipeConsumption && p.recipe?.items?.length) {
                    console.log(`   ✅ Entrando a cálculo de stock virtual...`)
                    console.log(`   📍 Iterando sobre TODOS los almacenes (${allWarehouseIds.length} almacenes)`)

                    const virtualStockLevels: any[] = []

                    allWarehouseIds.forEach(warehouseId => {
                        console.log(`\n   📂 Calculando para warehouse ${warehouseId}:`)

                        const maxQuantities = p.recipe.items.map((item: any) => {
                            if (!item.ingredient) {
                                console.log(`      - Item sin ingrediente`)
                                return 0
                            }

                            const sl = item.ingredient.stockLevels?.find((s: any) => s.warehouseId === warehouseId)
                            const ingredientStock = sl?.quantity || 0

                            if (item.quantity <= 0) {
                                console.log(`      - Item quantity <= 0`)
                                return 0
                            }

                            const canMake = Math.floor(ingredientStock / item.quantity)
                            console.log(`      - Stock: ${ingredientStock} / Necesita: ${item.quantity} = Puede hacer: ${canMake}`)

                            return canMake
                        })

                        const qty = maxQuantities.length > 0 ? Math.min(...maxQuantities) : 0
                        console.log(`   → Stock virtual calculado: ${qty}`)

                        virtualStockLevels.push({ warehouseId, quantity: qty })
                    })

                    stockLevels = virtualStockLevels
                    console.log(`   ✅ Stock virtual aplicado: ${JSON.stringify(stockLevels)}`)
                } else {
                    console.log(`   ⏭️  No aplica cálculo virtual (enableRecipeConsumption=${p.enableRecipeConsumption}, items=${p.recipe?.items?.length || 0})`)
                }

                const finalProduct = {
                    id: p.id,
                    name: p.name,
                    sku: p.sku,
                    barcode: p.barcode,
                    price: p.price,
                    taxRate: p.taxRate,
                    trackStock: p.trackStock,
                    stockLevels: stockLevels,
                }

                console.log(`   📤 PRODUCTO FINAL: stockLevels = ${JSON.stringify(finalProduct.stockLevels)}`)

                return finalProduct
            })

            console.log('\n' + '═'.repeat(100))
            console.log('RESUMEN DE PRODUCTOS RETORNADOS:')
            console.log('═'.repeat(100))

            for (const p of products) {
                const totalStock = p.stockLevels.reduce((sum: number, sl: any) => sum + sl.quantity, 0)
                console.log(`${p.name}: ${totalStock} unidades`)
            }

            console.log('\n')
        }

    } catch (error: any) {
        console.error('❌ Error:', error.message)
        console.error(error.stack)
        throw error
    } finally {
        await masterPrisma.$disconnect()
    }
}

simulatePOSAPI()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error)
        process.exit(1)
    })
