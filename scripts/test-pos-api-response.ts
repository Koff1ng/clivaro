import { PrismaClient } from '@prisma/client'
import { getTenantPrisma } from '../lib/tenant-db'
import { prisma as masterPrisma } from '../lib/db'

/**
 * Simular EXACTAMENTE lo que hace /api/pos/products AHORA con el fix
 */
async function testPOSAPIWithFix() {
    console.log('🔍 Testing /api/pos/products with the fix...\n')

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
            console.log('❌ Tenant not found')
            return
        }

        console.log(`✅ Tenant: ${tenant.name}\n`)

        const prisma = getTenantPrisma(tenant.databaseUrl)

        // EXACTAMENTE lo que hace el API
        const where: any = {
            active: true,
            productType: { not: 'RAW' },
        }

        // Fetch all active warehouses (THE FIX)
        const allWarehouses = await prisma.warehouse.findMany({
            where: { active: true },
            select: { id: true, name: true },
        })
        const allWarehouseIds = allWarehouses.map(w => w.id)

        console.log(`📦 All warehouses: ${allWarehouses.length}`)
        allWarehouses.forEach(w => console.log(`   - ${w.name}`))

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

        console.log(`\n📋 Products fetched: ${productsRaw.length}\n`)

        // Process products (EXACTLY as the API does WITH THE FIX)
        const products = productsRaw.map((p: any) => {
            let stockLevels = p.stockLevels || []

            console.log(`\n🔹 ${p.name} (${p.sku})`)
            console.log(`   enableRecipeConsumption: ${p.enableRecipeConsumption}`)
            console.log(`   Has recipe: ${!!p.recipe}`)
            console.log(`   Recipe items: ${p.recipe?.items?.length || 0}`)

            if (p.enableRecipeConsumption && p.recipe?.items?.length) {
                console.log(`   ✅ Calculating virtual stock for ALL warehouses...`)

                const virtualStockLevels: any[] = []

                allWarehouseIds.forEach(warehouseId => {
                    const maxQuantities = p.recipe.items.map((item: any) => {
                        if (!item.ingredient) return 0
                        const sl = item.ingredient.stockLevels?.find((s: any) => s.warehouseId === warehouseId)
                        const ingredientStock = sl?.quantity || 0
                        if (item.quantity <= 0) return 0
                        return Math.floor(ingredientStock / item.quantity)
                    })

                    const qty = maxQuantities.length > 0 ? Math.min(...maxQuantities) : 0
                    virtualStockLevels.push({ warehouseId, quantity: qty })
                })

                stockLevels = virtualStockLevels
                console.log(`   📊 Virtual stock calculated:`, JSON.stringify(stockLevels))
            } else {
                console.log(`   ⏭️  Using physical stock (no recipe or not enabled)`)
                console.log(`   📊 Physical stock:`, JSON.stringify(stockLevels))
            }

            return {
                id: p.id,
                name: p.name,
                sku: p.sku,
                barcode: p.barcode,
                price: p.price,
                taxRate: p.taxRate,
                trackStock: p.trackStock,
                stockLevels: stockLevels,
            }
        })

        console.log('\n' + '═'.repeat(100))
        console.log('API RESPONSE SUMMARY:')
        console.log('═'.repeat(100))

        products.forEach(p => {
            const totalStock = p.stockLevels.reduce((sum: number, sl: any) => sum + sl.quantity, 0)
            const stockByWarehouse = p.stockLevels.map((sl: any) => {
                const wh = allWarehouses.find(w => w.id === sl.warehouseId)
                return `${wh?.name || 'Unknown'}: ${sl.quantity}`
            }).join(', ')

            console.log(`\n${p.name}:`)
            console.log(`  Total: ${totalStock}`)
            console.log(`  Details: ${stockByWarehouse}`)
        })

        console.log('\n')

    } catch (error: any) {
        console.error('❌ Error:', error.message)
        console.error(error.stack)
        throw error
    } finally {
        await masterPrisma.$disconnect()
    }
}

testPOSAPIWithFix()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error)
        process.exit(1)
    })
