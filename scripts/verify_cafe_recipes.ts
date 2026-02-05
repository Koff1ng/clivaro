import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const TENANT_SLUG = 'cafe-singular'

async function main() {
    try {
        console.log('🔍 Buscando tenant cafe-singular...')

        const tenant = await prisma.tenant.findUnique({
            where: { slug: TENANT_SLUG }
        })

        if (!tenant) {
            throw new Error(`Tenant '${TENANT_SLUG}' no encontrado`)
        }

        console.log(`✅ Tenant encontrado: ${tenant.name}\n`)

        // Cambiar al schema del tenant
        await prisma.$executeRawUnsafe(`SET search_path TO "${tenant.id}", public`)

        // Obtener todos los productos con receta
        const productsWithRecipe = await prisma.product.findMany({
            where: {
                enableRecipeConsumption: true,
                productType: 'SELLABLE'
            },
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
            },
            orderBy: {
                sku: 'asc'
            }
        })

        console.log(`📋 Productos con receta habilitada: ${productsWithRecipe.length}\n`)

        let totalRecipes = 0
        let recipesWithIssues = 0
        let recipesOk = 0
        let missingRecipes = 0

        const issues: any[] = []

        for (const product of productsWithRecipe) {
            if (!product.recipe) {
                console.log(`❌ ${product.sku} - ${product.name}: SIN RECETA CREADA`)
                missingRecipes++
                issues.push({
                    sku: product.sku,
                    name: product.name,
                    issue: 'NO_RECIPE',
                    details: 'No tiene receta creada'
                })
                continue
            }

            totalRecipes++

            if (product.recipe.items.length === 0) {
                console.log(`⚠️  ${product.sku} - ${product.name}: Receta sin ingredientes`)
                recipesWithIssues++
                issues.push({
                    sku: product.sku,
                    name: product.name,
                    issue: 'EMPTY_RECIPE',
                    details: 'Receta existe pero no tiene ingredientes'
                })
                continue
            }

            // Verificar ingredientes
            const missingIngredients = product.recipe.items.filter(item => !item.ingredient)

            if (missingIngredients.length > 0) {
                console.log(`❌ ${product.sku} - ${product.name}: ${missingIngredients.length} ingredientes faltantes`)
                recipesWithIssues++
                issues.push({
                    sku: product.sku,
                    name: product.name,
                    issue: 'MISSING_INGREDIENTS',
                    details: `${missingIngredients.length} ingredientes no encontrados`,
                    total: product.recipe.items.length,
                    missing: missingIngredients.length
                })
            } else {
                console.log(`✅ ${product.sku} - ${product.name}: ${product.recipe.items.length} ingredientes OK`)
                recipesOk++
            }
        }

        console.log(`\n${'='.repeat(60)}`)
        console.log(`📊 RESUMEN DE VERIFICACIÓN:\n`)
        console.log(`Total productos con receta habilitada: ${productsWithRecipe.length}`)
        console.log(`\n✅ Recetas correctas: ${recipesOk}`)
        console.log(`⚠️  Recetas con problemas: ${recipesWithIssues}`)
        console.log(`❌ Sin receta creada: ${missingRecipes}`)
        console.log(`${'='.repeat(60)}\n`)

        if (issues.length > 0) {
            console.log(`\n⚠️  PROBLEMAS ENCONTRADOS:\n`)
            for (const issue of issues) {
                console.log(`\n${issue.sku} - ${issue.name}`)
                console.log(`  Tipo: ${issue.issue}`)
                console.log(`  Detalle: ${issue.details}`)
                if (issue.total) {
                    console.log(`  Total ingredientes: ${issue.total}`)
                    console.log(`  Faltantes: ${issue.missing}`)
                }
            }
        }

    } catch (error) {
        console.error('❌ Error:', error)
        throw error
    } finally {
        await prisma.$disconnect()
    }
}

main()
