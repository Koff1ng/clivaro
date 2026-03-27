import { PrismaClient } from '@prisma/client'
import { Client } from 'pg'

const prisma = new PrismaClient()

async function main() {
  const baseUrl = process.env.DATABASE_URL || process.env.DIRECT_URL || ''
  const tenants = await prisma.tenant.findMany()

  for (const tenant of tenants) {
    const slug = tenant.slug.toLowerCase().replace(/[^a-z0-9]/g, '_')
    const schema = `tenant_${slug}`
    console.log(`\n=== ${tenant.name} (${schema}) ===`)

    const client = new Client({ connectionString: baseUrl })
    await client.connect()
    try {
      await client.query(`SET search_path TO "${schema}"`)
      
      const units = await client.query(`SELECT id, name, symbol FROM "Unit" ORDER BY name`)
      console.log(`  Units (${units.rowCount}):`)
      for (const u of units.rows) {
        console.log(`    - ${u.name} (${u.symbol}) [${u.id}]`)
      }
      
      const convs = await client.query(`
        SELECT uc.id, uc."fromUnitId", uc."toUnitId", uc.multiplier,
               fu.name as from_name, fu.symbol as from_symbol,
               tu.name as to_name, tu.symbol as to_symbol
        FROM "UnitConversion" uc
        JOIN "Unit" fu ON fu.id = uc."fromUnitId"
        JOIN "Unit" tu ON tu.id = uc."toUnitId"
        ORDER BY fu.name
      `)
      console.log(`  Conversions (${convs.rowCount}):`)
      for (const c of convs.rows) {
        console.log(`    - ${c.from_name}(${c.from_symbol}) -> ${c.to_name}(${c.to_symbol}) x${c.multiplier}`)
      }
    } catch (e: any) {
      console.log(`  Error: ${e.message}`)
    }
    await client.end()
  }
  await prisma.$disconnect()
}

main().catch(console.error)
