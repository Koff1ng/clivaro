import { PrismaClient } from '@prisma/client'
import { getTenantPrisma } from '../lib/tenant-db'
import { prisma as masterPrisma } from '../lib/db'

/**
 * Script para diagnosticar por qué los tenants ven stock 0 en el POS
 * Verifica:
 * 1. Si el tenant existe y está activo
 * 2. Si tiene productos
 * 3. Si tiene warehouses
 * 4. Si tiene stock levels
 * 5. Si los productos tienen trackStock = true
 */
async function diagnoseStockIssue() {
    console.log('🔍 Diagnosticando problema de stock en tenants...\n')

    try {
        // 1. Obtener todos los tenants activos
        const tenants = await masterPrisma.tenant.findMany({
            where: { active: true },
            select: {
                id: true,
                name: true,
                slug: true,
                databaseUrl: true,
            }
        })

        console.log(`📊 Tenants activos: ${tenants.length}\n`)

        for (const tenant of tenants) {
            console.log('═'.repeat(100))
            console.log(`🏢 TENANT: ${tenant.name} (${tenant.slug})`)
            console.log(`   ID: ${tenant.id}`)
            console.log(`   Database URL: ${tenant.databaseUrl}`)
            console.log('═'.repeat(100))

            try {
                // Conectar a la base de datos del tenant
                const tenantPrisma = getTenantPrisma(tenant.databaseUrl)

                // 2. Contar productos
                const productsCount = await tenantPrisma.product.count()
                const activeProductsCount = await tenantPrisma.product.count({ where: { active: true } })
                console.log(`\n📦 Productos:`)
                console.log(`   Total: ${productsCount}`)
                console.log(`   Activos: ${activeProductsCount}`)

                // 3. Contar warehouses
                const warehousesCount = await tenantPrisma.warehouse.count()
                const activeWarehousesCount = await tenantPrisma.warehouse.count({ where: { active: true } })
                console.log(`\n🏭 Almacenes:`)
                console.log(`   Total: ${warehousesCount}`)
                console.log(`   Activos: ${activeWarehousesCount}`)

                // 4. Contar stock levels
                const stockLevelsCount = await tenantPrisma.stockLevel.count()
                console.log(`\n📊 Niveles de Stock:`)
                console.log(`   Total: ${stockLevelsCount}`)

                // 5. Obtener muestra de productos con/sin stock
                const productsWithStock = await tenantPrisma.product.findMany({
                    take: 5,
                    where: { active: true },
                    include: {
                        stockLevels: {
                            include: {
                                warehouse: {
                                    select: { name: true, active: true }
                                }
                            }
                        }
                    }
                })

                console.log(`\n📝 Muestra de productos (primeros 5):`)
                for (const product of productsWithStock) {
                    console.log(`\n   • ${product.name} (${product.sku})`)
                    console.log(`     trackStock: ${product.trackStock}`)
                    console.log(`     stockLevels: ${product.stockLevels.length}`)

                    if (product.stockLevels.length > 0) {
                        for (const sl of product.stockLevels) {
                            console.log(`       - ${sl.warehouse.name}: ${sl.quantity} unidades ${sl.warehouse.active ? '✅' : '❌ (inactivo)'}`)
                        }
                    } else {
                        console.log(`       ⚠️  SIN REGISTROS DE STOCK`)
                    }
                }

                // 6. Análisis de problemas
                console.log(`\n🔍 ANÁLISIS:`)

                const issues: string[] = []

                if (activeProductsCount === 0) {
                    issues.push('❌ No hay productos activos')
                }

                if (activeWarehousesCount === 0) {
                    issues.push('❌ No hay almacenes activos')
                }

                if (stockLevelsCount === 0) {
                    issues.push('❌ No hay registros de stock (StockLevel vacío)')
                }

                if (activeProductsCount > 0 && stockLevelsCount === 0) {
                    issues.push('⚠️  Hay productos pero NO hay niveles de stock configurados')
                }

                // Verificar productos sin stock
                const productsWithoutStock = await tenantPrisma.product.count({
                    where: {
                        active: true,
                        trackStock: true,
                        stockLevels: {
                            none: {}
                        }
                    }
                })

                if (productsWithoutStock > 0) {
                    issues.push(`⚠️  ${productsWithoutStock} productos activos con trackStock=true pero SIN registros de stock`)
                }

                if (issues.length === 0) {
                    console.log('   ✅ No se detectaron problemas obvios')
                } else {
                    console.log('   PROBLEMAS DETECTADOS:')
                    issues.forEach(issue => console.log(`   ${issue}`))
                }

                // 7. Recomendaciones
                if (issues.length > 0) {
                    console.log(`\n💡 RECOMENDACIONES:`)

                    if (stockLevelsCount === 0 && activeWarehousesCount > 0 && activeProductsCount > 0) {
                        console.log(`   1. Los productos y almacenes existen pero faltan registros de StockLevel`)
                        console.log(`   2. Puedes crear los registros manualmente o importar inventario`)
                        console.log(`   3. También puedes ejecutar un seed para datos de prueba`)
                    } else if (activeWarehousesCount === 0) {
                        console.log(`   1. Crear al menos un almacén activo`)
                        console.log(`   2. Luego configurar niveles de stock para los productos`)
                    } else if (activeProductsCount === 0) {
                        console.log(`   1. Crear productos activos`)
                        console.log(`   2. Configurar almacenes`)
                        console.log(`   3. Configurar niveles de stock`)
                    }
                }

            } catch (error: any) {
                console.log(`\n❌ ERROR al conectar/consultar base de datos del tenant:`)
                console.log(`   ${error.message}`)
                if (error.code) {
                    console.log(`   Código: ${error.code}`)
                }
            }

            console.log('\n')
        }

        console.log('═'.repeat(100))
        console.log('✅ Diagnóstico completado')
        console.log('═'.repeat(100))

    } catch (error: any) {
        console.error('❌ Error durante el diagnóstico:', error.message)
        throw error
    } finally {
        await masterPrisma.$disconnect()
    }
}

diagnoseStockIssue()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error)
        process.exit(1)
    })
