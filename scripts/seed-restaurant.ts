
import { PrismaClient } from '@prisma/client'
import { getTenantPrisma } from '../lib/tenant-db'
import { loadEnvConfig } from '@next/env'

// Load environment variables
loadEnvConfig(process.cwd())

const prisma = new PrismaClient()

async function main() {
    console.log('🍔 Starting Expanded Restaurant Seed with Categories...')

    // 1. Get the first tenant
    const tenant = await prisma.tenant.findFirst({
        where: { active: true },
        select: { id: true, name: true, slug: true, databaseUrl: true }
    })

    if (!tenant || !tenant.databaseUrl) {
        console.error('❌ No active tenant found to seed.')
        process.exit(1)
    }

    console.log(`📍 Targeting Tenant: ${tenant.name} (${tenant.slug})`)

    // 2. Get Tenant Client
    const tenantPrisma = getTenantPrisma(tenant.databaseUrl) as any

    // 3. Enable Restaurant Mode
    console.log('⚙️ Enabling Restaurant Mode...')
    await tenantPrisma.tenantSettings.upsert({
        where: { tenantId: tenant.id },
        create: { tenantId: tenant.id, enableRestaurantMode: true },
        update: { enableRestaurantMode: true }
    })

    // 4. Create Units (Prevent duplicates)
    console.log('📏 Creating/Verifying Units...')
    const units = [
        { name: 'Unidad', symbol: 'und' },
        { name: 'Kilogramo', symbol: 'kg' },
        { name: 'Gramo', symbol: 'g' },
        { name: 'Litro', symbol: 'l' },
        { name: 'Mililitro', symbol: 'ml' }
    ]

    const unitMap = new Map()
    for (const u of units) {
        const existing = await tenantPrisma.unit.findFirst({ where: { symbol: u.symbol } })
        if (existing) {
            unitMap.set(u.symbol, existing.id)
        } else {
            const unit = await tenantPrisma.unit.create({ data: u })
            unitMap.set(u.symbol, unit.id)
        }
    }

    // 5. Create Conversions (Idempotent)
    if (unitMap.has('kg') && unitMap.has('g')) {
        const from = unitMap.get('kg'), to = unitMap.get('g')
        const exists = await tenantPrisma.unitConversion.findFirst({ where: { fromUnitId: from, toUnitId: to } })
        if (!exists) await tenantPrisma.unitConversion.create({ data: { fromUnitId: from, toUnitId: to, multiplier: 1000 } })
    }
    if (unitMap.has('l') && unitMap.has('ml')) {
        const from = unitMap.get('l'), to = unitMap.get('ml')
        const exists = await tenantPrisma.unitConversion.findFirst({ where: { fromUnitId: from, toUnitId: to } })
        if (!exists) await tenantPrisma.unitConversion.create({ data: { fromUnitId: from, toUnitId: to, multiplier: 1000 } })
    }

    // 6. Create Clients
    console.log('👥 Creating Customers...')
    const customers = [
        { name: 'Juan Pérez', email: 'juan@example.com', phone: '3001234567', taxId: '10101010' },
        { name: 'María Rodríguez', email: 'maria@example.com', phone: '3109876543', taxId: '20202020' },
        { name: 'Consumidor Final', taxId: '222222222222' }
    ]
    for (const c of customers) {
        const exists = await tenantPrisma.customer.findFirst({ where: { taxId: c.taxId } })
        if (!exists) await tenantPrisma.customer.create({ data: c })
    }

    // 7. Create Suppliers
    console.log('🚚 Creating Suppliers...')
    const suppliers = [
        { name: 'Distribuidora de Carnes El Torito', taxId: '900100100', phone: '601-2345678' },
        { name: 'Panadería La Central', taxId: '900200200', phone: '601-8765432' },
        { name: 'Salsas y Aderezos Ltda', taxId: '900300300', phone: '601-3334444' }
    ]
    for (const s of suppliers) {
        const exists = await tenantPrisma.supplier.findFirst({ where: { taxId: s.taxId } })
        if (!exists) await tenantPrisma.supplier.create({ data: s })
    }

    // 8. Create Raw Ingredients with Categories
    console.log('🥩 Creating Ingredients...')
    const ingredientsData = [
        { name: 'Carne de Res Molida', cost: 15000, unit: 'kg', category: 'Carnes' },
        { name: 'Pechuga de Pollo', cost: 12000, unit: 'kg', category: 'Carnes' },
        { name: 'Pan Hamburguesa', cost: 800, unit: 'und', category: 'Panadería' },
        { name: 'Pan Perro Caliente', cost: 700, unit: 'und', category: 'Panadería' },
        { name: 'Salchicha Americana', cost: 1500, unit: 'und', category: 'Carnes' },
        { name: 'Queso Cheddar', cost: 40000, unit: 'kg', category: 'Lácteos' },
        { name: 'Papa Criolla (Para Francesa)', cost: 3000, unit: 'kg', category: 'Verduras' },
        { name: 'Aceite Vegetal', cost: 8000, unit: 'l', category: 'Despensa' },
        { name: 'Salsa Tomate', cost: 10000, unit: 'kg', category: 'Salsas' },
        { name: 'Mayonesa', cost: 12000, unit: 'kg', category: 'Salsas' },
    ]

    const ingredientMap = new Map()
    for (const ing of ingredientsData) {
        let product = await tenantPrisma.product.findFirst({ where: { name: ing.name } })
        if (!product) {
            product = await tenantPrisma.product.create({
                data: {
                    name: ing.name,
                    sku: `ING-${Math.floor(Math.random() * 100000)}`,
                    productType: 'RAW',
                    cost: ing.cost,
                    price: ing.cost * 1.2,
                    unitOfMeasure: ing.unit === 'und' ? 'UNIT' : (ing.unit === 'kg' ? 'KILO' : 'LITER'),
                    trackStock: true,
                    category: ing.category
                }
            })
        } else {
            // Update category if exists
            await tenantPrisma.product.update({
                where: { id: product.id },
                data: { category: ing.category }
            })
        }
        ingredientMap.set(ing.name, product.id)
    }

    // 9. Create Products (Sellable) & Recipes with Categories
    console.log('🍽️ Creating Menu Items & Recipes...')

    const createRecipeProduct = async (name: string, price: number, category: string, recipeItems: any[]) => {
        let product = await tenantPrisma.product.findFirst({ where: { name } })
        if (!product) {
            product = await tenantPrisma.product.create({
                data: {
                    name,
                    sku: `MENU-${Math.floor(Math.random() * 100000)}`,
                    productType: 'SELLABLE',
                    enableRecipeConsumption: true,
                    price,
                    cost: 0,
                    taxRate: 8,
                    category
                }
            })

            const recipe = await tenantPrisma.recipe.create({
                data: { productId: product.id, yield: 1, active: true }
            })

            for (const item of recipeItems) {
                const ingId = ingredientMap.get(item.name)
                const uId = unitMap.get(item.unit)
                if (ingId && uId) {
                    await tenantPrisma.recipeItem.create({
                        data: { recipeId: recipe.id, ingredientId: ingId, quantity: item.qty, unitId: uId }
                    })
                }
            }
        } else {
            // Update category
            await tenantPrisma.product.update({
                where: { id: product.id },
                data: { category }
            })
        }
        return product
    }

    await createRecipeProduct('Hamburguesa Clásica', 25000, 'Hamburguesas', [
        { name: 'Carne de Res Molida', qty: 0.150, unit: 'kg' },
        { name: 'Pan Hamburguesa', qty: 1, unit: 'und' },
        { name: 'Queso Cheddar', qty: 0.020, unit: 'kg' },
        { name: 'Salsa Tomate', qty: 0.010, unit: 'kg' },
        { name: 'Mayonesa', qty: 0.010, unit: 'kg' }
    ])

    await createRecipeProduct('Perro Caliente Especial', 18000, 'Perros Calientes', [
        { name: 'Salchicha Americana', qty: 1, unit: 'und' },
        { name: 'Pan Perro Caliente', qty: 1, unit: 'und' },
        { name: 'Queso Cheddar', qty: 0.015, unit: 'kg' },
        { name: 'Papa Criolla (Para Francesa)', qty: 0.020, unit: 'kg' },
        { name: 'Salsa Tomate', qty: 0.015, unit: 'kg' }
    ])

    await createRecipeProduct('Papas a la Francesa', 8000, 'Acompañamientos', [
        { name: 'Papa Criolla (Para Francesa)', qty: 0.200, unit: 'kg' },
        { name: 'Aceite Vegetal', qty: 0.010, unit: 'l' }
    ])

    // 10. Retail Products (Drinks) with Categories
    console.log('🥤 Creating Drinks (Retail)...')
    const drinks = [
        { name: 'Coca Cola 400ml', price: 5000, cost: 2500, category: 'Bebidas' },
        { name: 'Agua Manantial 500ml', price: 4000, cost: 1800, category: 'Bebidas' },
        { name: 'Cerveza Club Colombia', price: 7000, cost: 3500, category: 'Bebidas' }
    ]
    for (const drink of drinks) {
        const exists = await tenantPrisma.product.findFirst({ where: { name: drink.name } })
        if (!exists) {
            await tenantPrisma.product.create({
                data: {
                    name: drink.name,
                    sku: `DRINK-${Math.floor(Math.random() * 10000)}`,
                    productType: 'RETAIL',
                    price: drink.price,
                    cost: drink.cost,
                    trackStock: true,
                    taxRate: 19,
                    category: drink.category
                }
            })
        } else {
            await tenantPrisma.product.update({
                where: { id: exists.id },
                data: { category: drink.category }
            })
        }
    }

    // 11. Create Initial Stock (Purchase Order) - Minimal check to avoid spamming
    console.log('📦 Verifying Inventory...')
    const supplier = await tenantPrisma.supplier.findFirst()
    const warehouse = await tenantPrisma.warehouse.findFirst() || await tenantPrisma.warehouse.create({ data: { name: 'Principal' } })
    const user = await tenantPrisma.user.findFirst()

    if (supplier && warehouse && user) {
        const hasStock = await tenantPrisma.stockLevel.findFirst()
        if (!hasStock) {
            console.log('   Creating initial stock...')
            const po = await tenantPrisma.purchaseOrder.create({
                data: {
                    number: `OC-${Math.floor(Math.random() * 1000)}`,
                    supplierId: supplier.id,
                    status: 'COMPLETED',
                    createdById: user.id
                }
            })

            const gr = await tenantPrisma.goodsReceipt.create({
                data: {
                    number: `REM-${Math.floor(Math.random() * 1000)}`,
                    purchaseOrderId: po.id,
                    warehouseId: warehouse.id,
                    createdById: user.id
                }
            })

            const allProducts = await tenantPrisma.product.findMany({ where: { productType: { in: ['RAW', 'RETAIL'] } } })
            for (const p of allProducts) {
                const qty = 100
                await tenantPrisma.stockLevel.create({
                    data: { warehouseId: warehouse.id, productId: p.id, quantity: qty }
                })
                await tenantPrisma.stockMovement.create({
                    data: {
                        warehouseId: warehouse.id,
                        productId: p.id,
                        type: 'IN',
                        quantity: qty,
                        cost: p.cost,
                        reasonCode: 'PURCHASE',
                        createdById: user.id
                    }
                })
                await tenantPrisma.goodsReceiptItem.create({
                    data: {
                        goodsReceiptId: gr.id,
                        productId: p.id,
                        quantity: qty,
                        unitCost: p.cost
                    }
                })
            }
        }
    }

    // 12. Open Cash Shift
    console.log('💰 Verifying Cash Shift...')
    const openShift = await tenantPrisma.cashShift.findFirst({ where: { status: 'OPEN' } })
    if (!openShift && user) {
        console.log('   Opening new shift...')
        await tenantPrisma.cashShift.create({
            data: {
                userId: user.id,
                status: 'OPEN',
                startingCash: 200000,
                expectedCash: 200000,
                openedAt: new Date()
            }
        })
    }

    console.log('✅ Categorization Seed Completed!')
}

main()
    .catch((e) => {
        console.error(e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
