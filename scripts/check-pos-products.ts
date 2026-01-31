import { PrismaClient } from '@prisma/client'
import { getTenantPrisma } from '../lib/tenant-db'
import { prisma as masterPrisma } from '../lib/db'

/**
 * Verificar qué productos se están mostrando en el POS
 * y si están siendo filtrados incorrectamente
 */
async function checkPOSProducts() {
    console.log('🔍 Verificando productos para POS en tenants...\n')

    try {
        const tenants = await masterPrisma.tenant.findMany({
            where: { active: true },
            select: {
                id: true,
                name: true,
                slug: true,
                databaseUrl: true,
            }
        })

        for (const tenant of tenants) {
            console.log('═'.repeat(100))
            console.log(`🏢 TENANT: ${tenant.name}`)
            console.log('═'.repeat(100))

            const tenantPrisma = getTenantPrisma(tenant.databaseUrl)

            // Consulta tal como lo hace el API /api/pos/products
            const where: any = {
                active: true,
                productType: { not: 'RAW' }, // OCULTA INGREDIENTES
            }

            const allActiveProducts = await tenantPrisma.product.count({ where: { active: true } })
            const posVisibleProducts = await tenantPrisma.product.count({ where })

            console.log(`\n📊 ESTADÍSTICAS:`)
            console.log(`   Total productos activos: ${allActiveProducts}`)
            console.log(`   Productos visibles en POS: ${posVisibleProducts}`)
            console.log(`   Productos OCULTOS del POS: ${allActiveProducts - posVisibleProducts}`)

            // Ver tipos de productos
            const productsByType = await tenantPrisma.product.groupBy({
                by: ['productType'],
                where: { active: true },
                _count: true,
            })

            console.log(`\n📦 PRODUCTOS POR TIPO:`)
            for (const group of productsByType) {
                const isHidden = group.productType === 'RAW'
                console.log(`   ${group.productType}: ${group._count} ${isHidden ? '❌ (OCULTO en POS)' : '✅'}`)
            }

            // Obtener muestra de productos que SÍ se muestran en POS
            const visibleProducts = await tenantPrisma.product.findMany({
                where,
                take: 5,
                include: {
                    stockLevels: {
                        select: {
                            warehouseId: true,
                            quantity: true,
                            warehouse: { select: { name: true } }
                        }
                    }
                }
            })

            console.log(`\n✅ PRODUCTOS VISIBLES EN POS (muestra):`)
            if (visibleProducts.length === 0) {
                console.log(`   ❌ NO HAY PRODUCTOS VISIBLES EN EL POS`)
                console.log(`   ⚠️  Todos los productos están marcados como RAW (ingredientes)`)
            } else {
                for (const p of visibleProducts) {
                    const totalStock = p.stockLevels.reduce((sum, sl) => sum + sl.quantity, 0)
                    console.log(`   • ${p.name} (${p.sku})`)
                    console.log(`     Tipo: ${p.productType}`)
                    console.log(`     Stock total: ${totalStock}`)
                }
            }

            // Obtener productos OCULTOS que SÍ tienen stock
            const hiddenProducts = await tenantPrisma.product.findMany({
                where: {
                    active: true,
                    productType: 'RAW',
                    stockLevels: {
                        some: {
                            quantity: { gt: 0 }
                        }
                    }
                },
                take: 5,
                include: {
                    stockLevels: {
                        select: {
                            quantity: true,
                            warehouse: { select: { name: true } }
                        }
                    }
                }
            })

            if (hiddenProducts.length > 0) {
                console.log(`\n❌ PRODUCTOS OCULTOS DEL POS (con stock):`)
                for (const p of hiddenProducts) {
                    const totalStock = p.stockLevels.reduce((sum, sl) => sum + sl.quantity, 0)
                    console.log(`   • ${p.name} (${p.sku})`)
                    console.log(`     Tipo: ${p.productType}`)
                    console.log(`     Stock total: ${totalStock} ⚠️  TIENE STOCK PERO NO SE MUESTRA EN POS`)
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

checkPOSProducts()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error)
        process.exit(1)
    })
