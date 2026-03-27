import { Client } from 'pg'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const tenant = await prisma.tenant.findFirst({ where: { slug: 'heladeria' } })
  if (!tenant) { console.log('Tenant not found'); return }

  const client = new Client({ connectionString: tenant.databaseUrl })
  await client.connect()

  const schema = 'tenant_cmn2ngd9h00008ygrjcr08qqi'

  // Get ALL products
  console.log(`\n=== Products in ${schema} ===`)
  const products = await client.query(`SELECT * FROM "${schema}"."Product" ORDER BY "createdAt"`)
  console.log(`Total: ${products.rowCount}`)
  for (const p of products.rows) {
    console.log(`  SKU: ${p.sku} | Name: ${p.name} | Price: ${p.price} | Cost: ${p.cost} | Category: ${p.category}`)
  }

  // Check if there are deleted products or soft-deletes
  console.log(`\n=== Product columns ===`)
  const cols = await client.query(`
    SELECT column_name, data_type FROM information_schema.columns 
    WHERE table_schema = $1 AND table_name = 'Product'
    ORDER BY ordinal_position
  `, [schema])
  for (const c of cols.rows) {
    console.log(`  ${c.column_name}: ${c.data_type}`)
  }

  // Check StockLevel
  console.log(`\n=== StockLevels ===`)
  const stock = await client.query(`SELECT * FROM "${schema}"."StockLevel"`)
  console.log(`Total: ${stock.rowCount}`)
  for (const s of stock.rows) {
    console.log(`  Product: ${s.productId} | Qty: ${s.quantity}`)
  }

  // Check Invoices
  console.log(`\n=== Invoices ===`)
  const inv = await client.query(`SELECT * FROM "${schema}"."Invoice"`)
  console.log(`Total: ${inv.rowCount}`)

  await client.end()
  await prisma.$disconnect()
}

main().catch(console.error)
