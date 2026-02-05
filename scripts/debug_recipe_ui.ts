import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const TENANT_SLUG = 'cafe-singular'

async function main() {
    try {
        const tenant = await prisma.tenant.findUnique({
            where: { slug: TENANT_SLUG }
        })

        if (!tenant) {
            throw new Error(`Tenant '${TENANT_SLUG}' no encontrado`)
        }

        await prisma.$executeRawUnsafe(`SET search_path TO "${tenant.id}", public`)

        // Buscar "A la española"
        const product = await prisma.product.findFirst({
            where: { sku: 'DES-004' },
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

        if (!product || !product.recipe) {
            console.log('❌ Producto o receta no encontrado')
            return
        }

        console.log(`\n📋 Receta de: ${product.name}\n`)
        console.log(`${'='.repeat(80)}`)

        for (const item of product.recipe.items) {
            const ing = item.ingredient
            console.log(`\nIngrediente ID: ${item.ingredientId}`)
            console.log(`  Nombre: ${ing?.name || '❌ NULL'}`)
            console.log(`  SKU: ${ing?.sku || '❌ NULL'}`)
            console.log(`  Active: ${ing?.active}`)
            console.log(`  ProductType: ${ing?.productType}`)
            console.log(`  Cantidad: ${item.quantity}`)
            console.log(`  Unidad producto: ${ing?.unitOfMeasure}`)

            // Verificar si el ingrediente existe como producto independiente
            if (ing) {
                const exists = await prisma.product.findUnique({
                    where: { id: ing.id }
                })
                console.log(`  ¿Existe en DB?: ${exists ? '✅ SÍ' : '❌ NO'}`)
            }
        }

        console.log(`\n${'='.repeat(80)}`)

        // Verificar específicamente ING-002 y ING-031
        console.log(`\n🔍 Verificando ingredientes problemáticos:\n`)

        const quesoCrema = await prisma.product.findFirst({
            where: { sku: 'ING-002' }
        })

        const papaCriolla = await prisma.product.findFirst({
            where: { sku: 'ING-031' }
        })

        console.log(`ING-002 (Queso crema):`)
        console.log(`  Existe: ${quesoCrema ? '✅' : '❌'}`)
        if (quesoCrema) {
            console.log(`  ID: ${quesoCrema.id}`)
            console.log(`  Nombre: ${quesoCrema.name}`)
            console.log(`  Active: ${quesoCrema.active}`)
            console.log(`  ProductType: ${quesoCrema.productType}`)
        }

        console.log(`\nING-031 (Papa criolla):`)
        console.log(`  Existe: ${papaCriolla ? '✅' : '❌'}`)
        if (papaCriolla) {
            console.log(`  ID: ${papaCriolla.id}`)
            console.log(`  Nombre: ${papaCriolla.name}`)
            console.log(`  Active: ${papaCriolla.active}`)
            console.log(`  ProductType: ${papaCriolla.productType}`)
        }

    } catch (error) {
        console.error('❌ Error:', error)
        throw error
    } finally {
        await prisma.$disconnect()
    }
}

main()
