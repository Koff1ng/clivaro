import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const TENANT_SLUG = 'cafe-singular'

async function main() {
    try {
        console.log('🔍 Analizando recetas en detalle...\n')

        const tenant = await prisma.tenant.findUnique({
            where: { slug: TENANT_SLUG }
        })

        if (!tenant) {
            throw new Error(`Tenant '${TENANT_SLUG}' no encontrado`)
        }

        // Cambiar al schema del tenant
        await prisma.$executeRawUnsafe(`SET search_path TO "${tenant.id}", public`)

        // Obtener las primeras 5 recetas con todos los detalles
        const recipes = await prisma.recipe.findMany({
            take: 5,
            include: {
                product: true,
                items: {
                    include: {
                        ingredient: true,
                        unit: true
                    }
                }
            }
        })

        console.log(`📋 Mostrando detalle de ${recipes.length} recetas:\n`)

        for (const recipe of recipes) {
            console.log(`${'='.repeat(80)}`)
            console.log(`PRODUCTO: ${recipe.product.sku} - ${recipe.product.name}`)
            console.log(`Rendimiento: ${recipe.yield}`)
            console.log(`Activa: ${recipe.active}`)
            console.log(`\nINGREDIENTES (${recipe.items.length}):`)
            console.log(`${'='.repeat(80)}`)

            for (const item of recipe.items) {
                console.log(`\n  ├─ Ingrediente ID: ${item.ingredientId}`)
                console.log(`  ├─ Nombre: ${item.ingredient?.name || '❌ VACÍO'}`)
                console.log(`  ├─ SKU: ${item.ingredient?.sku || '❌ VACÍO'}`)
                console.log(`  ├─ Cantidad: ${item.quantity}`)
                console.log(`  ├─ Unidad ID: ${item.unitId || 'null'}`)
                console.log(`  ├─ Unidad: ${item.unit?.name || 'No especificada (usar unidad del producto)'}`)
                console.log(`  ├─ Unidad producto: ${item.ingredient?.unitOfMeasure || '❌ VACÍO'}`)
                console.log(`  └─ Costo unitario: $${item.ingredient?.cost || 0}`)
            }
            console.log(`\n`)
        }

        // Verificar si hay items con unitId null
        const itemsWithoutUnit = await prisma.recipeItem.findMany({
            where: {
                unitId: null
            },
            include: {
                recipe: {
                    include: {
                        product: true
                    }
                },
                ingredient: true
            }
        })

        console.log(`\n${'='.repeat(80)}`)
        console.log(`📊 ANÁLISIS DE UNIDADES:`)
        console.log(`${'='.repeat(80)}`)
        console.log(`\nItems sin unitId especificado: ${itemsWithoutUnit.length}`)
        console.log(`(Esto es normal - se usa la unidad del producto ingrediente)\n`)

        if (itemsWithoutUnit.length > 0) {
            console.log(`Ejemplos (primeros 10):`)
            itemsWithoutUnit.slice(0, 10).forEach((item, idx) => {
                console.log(`\n${idx + 1}. ${item.recipe.product.name}`)
                console.log(`   Ingrediente: ${item.ingredient.name}`)
                console.log(`   Unidad del ingrediente: ${item.ingredient.unitOfMeasure}`)
                console.log(`   Cantidad: ${item.quantity}`)
            })
        }

    } catch (error) {
        console.error('❌ Error:', error)
        throw error
    } finally {
        await prisma.$disconnect()
    }
}

main()
