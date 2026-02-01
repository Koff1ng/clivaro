import { PrismaClient } from '@prisma/client'
import { getTenantPrisma } from '../lib/tenant-db'
import { prisma as masterPrisma } from '../lib/db'

/**
 * Simular la REQUEST REAL del frontend al API /api/pos/products
 * para ver exactamente qué está retornando
 */
async function testRealAPICall() {
    console.log('🔍 Simulando llamada REAL desde el frontend al API...\n')

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

        console.log(`✅ Tenant: ${tenant.name}`)
        console.log(`   Database URL: ${tenant.databaseUrl.substring(0, 50)}...\n`)

        const prisma = getTenantPrisma(tenant.databaseUrl)

        // Simulate API request
        const where: any = {
            active: true,
            productType: { not: 'RAW' },
        }

        // Fetch all active warehouses
        const allWarehouses = await prisma.warehouse.findMany({
            where: { active: true },
            select: { id: true, name: true },
        })
        const allWarehouseIds = allWarehouses.map(w => w.id)

        console.log(`📦 Warehouses: ${allWarehouses.length}`)
        allWarehouses.forEach(w => console.log(`   - ${w.name} (${w.id})`))

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

        console.log(`\n📋 Products fetched from DB: ${productsRaw.length}\n`)

        // Process products EXACTLY as the API does
        const products = productsRaw.map((p: any) => {
            let stockLevels = p.stockLevels || []

            if (p.enableRecipeConsumption && p.recipe?.items?.length) {
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

        console.log('═'.repeat(100))
        console.log('SIMULATED API RESPONSE (what frontend receives):')
        console.log('═'.repeat(100))

        console.log('\n🔹 Example: First warehouse stock for each product:\n')

        const firstWarehouseId = allWarehouseIds[0]
        const firstWarehouse = allWarehouses.find(w => w.id === firstWarehouseId)

        products.forEach((p: any) => {
            const stockForFirstWarehouse = p.stockLevels.find((sl: any) => sl.warehouseId === firstWarehouseId)
            const qty = stockForFirstWarehouse?.quantity ?? 0

            console.log(`${p.name}:`)
            console.log(`  trackStock: ${p.trackStock}`)
            console.log(`  stockLevels.length: ${p.stockLevels.length}`)
            console.log(`  Stock in ${firstWarehouse?.name}: ${qty}`)
            console.log(`  All stockLevels: ${JSON.stringify(p.stockLevels)}`)
            console.log()
        })

        console.log('═'.repeat(100))
        console.log('\n📊 VERIFICATION:')
        console.log('   Do ALL products have stockLevels?', products.every((p: any) => p.stockLevels.length > 0))
        console.log('   Products with empty stockLevels:', products.filter((p: any) => p.stockLevels.length === 0).map((p: any) => p.name))
        console.log()

    } catch (error: any) {
        console.error('❌ Error:', error.message)
        console.error(error.stack)
        throw error
    } finally {
        await masterPrisma.$disconnect()
    }
}

testRealAPICall()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error)
        process.exit(1)
    })
