import { PrismaClient } from '@prisma/client'
import { Client } from 'pg'

const prisma = new PrismaClient()

async function main() {
  const tenants = await prisma.tenant.findMany()
  
  console.log('=== ALL TENANTS (including inactive) ===\n')
  for (const t of tenants) {
    let schema = 'unknown'
    try {
      const url = new URL(t.databaseUrl)
      schema = url.searchParams.get('schema') || 'public'
    } catch (e) {}
    
    console.log(`ID: ${t.id}`)
    console.log(`  Name: ${t.name} | Slug: ${t.slug}`)
    console.log(`  Active: ${t.active} | Schema: ${schema}`)
    console.log(`  Created: ${t.createdAt}`)
    console.log()
  }

  // Now check which cmn schemas have actual data
  const firstTenant = tenants[0]
  if (firstTenant?.databaseUrl) {
    const client = new Client({ connectionString: firstTenant.databaseUrl })
    await client.connect()

    console.log('\n=== SCHEMAS WITH DATA ===\n')
    const schemas = await client.query(`
      SELECT schema_name FROM information_schema.schemata 
      WHERE schema_name LIKE 'tenant_%'
      ORDER BY schema_name
    `)

    for (const s of schemas.rows) {
      try {
        const users = await client.query(`SELECT COUNT(*) as cnt FROM "${s.schema_name}"."User"`)
        const products = await client.query(`SELECT COUNT(*) as cnt FROM "${s.schema_name}"."Product"`)
        const invoices = await client.query(`SELECT COUNT(*) as cnt FROM "${s.schema_name}"."Invoice"`)
        const customers = await client.query(`SELECT COUNT(*) as cnt FROM "${s.schema_name}"."Customer"`)
        
        const u = users.rows[0].cnt
        const p = products.rows[0].cnt
        const i = invoices.rows[0].cnt
        const c = customers.rows[0].cnt
        
        if (parseInt(u) > 0 || parseInt(p) > 0) {
          console.log(`Schema: ${s.schema_name}`)
          console.log(`  Users: ${u} | Products: ${p} | Invoices: ${i} | Customers: ${c}`)
        }
      } catch (e) {}
    }
    await client.end()
  }

  await prisma.$disconnect()
}

main().catch(console.error)
