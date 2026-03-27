import { PrismaClient } from '@prisma/client'
import { Client } from 'pg'

const prisma = new PrismaClient()

async function main() {
  const tenant = await prisma.tenant.findFirst({ where: { slug: 'heladeria' } })
  if (!tenant) { console.log('Tenant not found'); return }

  const client = new Client({ connectionString: tenant.databaseUrl })
  await client.connect()

  const schema = 'tenant_cmn2ngd9h00008ygrjcr08qqi'

  // Check StockLevel columns first
  const slCols = await client.query(`
    SELECT column_name FROM information_schema.columns 
    WHERE table_schema = $1 AND table_name = 'StockLevel' ORDER BY ordinal_position
  `, [schema])
  console.log('StockLevel columns:', slCols.rows.map(r => r.column_name))

  const existing = await client.query(`SELECT "createdById" FROM "${schema}"."Product" LIMIT 1`)
  const createdById = existing.rows[0]?.createdById || null

  const missingProducts = [
    { sku: 'BEBIDA 04', name: 'Gaseosa Postobon 400 mililitros', category: 'Bebidas', unitOfMeasure: 'DOZEN', cost: 28000, price: 3500 },
    { sku: 'BEBIDA 05', name: 'Jugos Nitos botella', category: 'Bebidas', unitOfMeasure: 'DOZEN', cost: 30000, price: 3500 },
    { sku: 'BEBIDA 06', name: 'Soda', category: 'Bebidas', unitOfMeasure: 'UNIT', cost: 2166, price: 4000 },
  ]

  const wh = await client.query(`SELECT "id" FROM "${schema}"."Warehouse" WHERE "active" = true ORDER BY "createdAt" LIMIT 1`)
  const warehouseId = wh.rows[0]?.id

  for (const p of missingProducts) {
    const exists = await client.query(`SELECT 1 FROM "${schema}"."Product" WHERE "sku" = $1`, [p.sku])
    if (exists.rowCount && exists.rowCount > 0) {
      console.log(`⚠️ ${p.sku} already exists, skipping`)
      continue
    }

    const id = `restored_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    const now = new Date().toISOString()

    await client.query(`
      INSERT INTO "${schema}"."Product" (
        "id", "sku", "name", "category", "unitOfMeasure", "productType",
        "cost", "price", "taxRate", "trackStock", "active",
        "enableRecipeConsumption", "createdAt", "updatedAt", "createdById",
        "stockAlertEnabled", "percentageMerma", "lastCost", "averageCost"
      ) VALUES ($1,$2,$3,$4,$5,'RETAIL',$6,$7,0,true,true,false,$8,$9,$10,true,0,$11,$12)
    `, [id, p.sku, p.name, p.category, p.unitOfMeasure, p.cost, p.price, now, now, createdById, p.cost, p.cost])
    console.log(`✅ Restored: ${p.sku} - ${p.name}`)

    // Create stock level - only with required columns
    if (warehouseId) {
      const slId = `sl_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
      try {
        await client.query(`
          INSERT INTO "${schema}"."StockLevel" ("id", "warehouseId", "productId", "quantity", "minStock", "maxStock")
          VALUES ($1, $2, $3, 0, 0, 0)
        `, [slId, warehouseId, id])
        console.log(`   + StockLevel created`)
      } catch (e: any) {
        console.log(`   ⚠️ StockLevel error: ${e.message}`)
      }
    }
  }

  // Fix StockLevel for Botella agua too
  const botella = await client.query(`SELECT "id" FROM "${schema}"."Product" WHERE "sku" = 'Bebida 03'`)
  if (botella.rows[0]) {
    const slExists = await client.query(`SELECT 1 FROM "${schema}"."StockLevel" WHERE "productId" = $1`, [botella.rows[0].id])
    if (!slExists.rowCount || slExists.rowCount === 0) {
      if (warehouseId) {
        try {
          await client.query(`
            INSERT INTO "${schema}"."StockLevel" ("id", "warehouseId", "productId", "quantity", "minStock", "maxStock")
            VALUES ($1, $2, $3, 0, 0, 0)
          `, [`sl_fix_${Date.now()}`, warehouseId, botella.rows[0].id])
          console.log(`✅ StockLevel for Botella agua created`)
        } catch (e: any) {
          console.log(`⚠️ Botella agua StockLevel: ${e.message}`)
        }
      }
    }
  }

  // Final count
  const all = await client.query(`SELECT "sku", "name", "price", "cost" FROM "${schema}"."Product" WHERE "active" = true ORDER BY "sku"`)
  console.log(`\n📊 Total active products: ${all.rowCount}`)
  for (const r of all.rows) {
    console.log(`  ${r.sku} | ${r.name} | $${r.price} | $${r.cost}`)
  }

  await client.end()
  await prisma.$disconnect()
}

main().catch(console.error)
