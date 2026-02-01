import { PrismaClient } from '@prisma/client'
import { getTenantPrisma } from '../lib/tenant-db'
import { prisma as masterPrisma } from '../lib/db'

/**
 * Verificar QUÉ ALMACÉN está seleccionado por defecto en el POS
 * y si hay algún problema con el orden de los warehouses
 */
async function checkWarehouseOrder() {
    console.log('🔍 Verificando orden de almacenes en la comitiva...\n')

    const databaseUrl = process.env.COMITIVA_DATABASE_URL || process.env.DATABASE_URL

    if (!databaseUrl) {
        console.error('❌ No database URL found in env')
        return
    }

    try {
        const prisma = new PrismaClient({
            datasources: {
                db: {
                    url: databaseUrl
                }
            }
        })

        // Get warehouses in the SAME ORDER as the API returns them
        const warehouses = await prisma.warehouse.findMany({
            where: { active: true },
            select: { id: true, name: true, createdAt: true },
        })

        console.log(`📦 Almacenes (en orden que el API los retorna):`)
        warehouses.forEach((w, idx) => {
            console.log(`   ${idx + 1}. ${w.name} (${w.id})`)
            if (idx === 0) {
                console.log(`      👉 ESTE es el que el POS selecciona por defecto`)
            }
        })

        // Get products with recipes
        const productsWithRecipes = await prisma.product.findMany({
            where: {
                active: true,
                enableRecipeConsumption: true,
                productType: { not: 'RAW' }
            },
            select: {
                id: true,
                name: true,
                sku: true,
            },
            take: 5
        })

        console.log(`\n📋 Productos con recetas: ${productsWithRecipes.length}`)

        // Simulate what the POS does with the first warehouse
        const firstWarehouse = warehouses[0]
        console.log(`\n🔍 Simulando selección del primer almacén: ${firstWarehouse?.name}`)

        await prisma.$disconnect()

    } catch (error: any) {
        console.error('❌ Error:', error.message)
        throw error
    }
}

checkWarehouseOrder()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error)
        process.exit(1)
    })
