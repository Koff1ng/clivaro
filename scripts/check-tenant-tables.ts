import { PrismaClient } from '@prisma/client'
import { Client } from 'pg'

const prisma = new PrismaClient()

async function main() {
  const tenants = await prisma.tenant.findMany({ where: { active: true } })
  console.log(`Found ${tenants.length} active tenants\n`)

  for (const tenant of tenants) {
    if (!tenant.databaseUrl) {
      console.log(`⚠️  ${tenant.name}: No DB URL`)
      continue
    }

    const client = new Client({ connectionString: tenant.databaseUrl })
    try {
      await client.connect()

      let schemaName = 'public'
      try {
        const url = new URL(tenant.databaseUrl)
        schemaName = url.searchParams.get('schema') || 'public'
      } catch (e) {}

      console.log(`\n=== ${tenant.name} (${tenant.slug}) - Schema: ${schemaName} ===`)

      // List ALL tables in this schema
      const tables = await client.query(`
        SELECT table_name FROM information_schema.tables 
        WHERE table_schema = $1 AND table_type = 'BASE TABLE'
        ORDER BY table_name
      `, [schemaName])

      console.log(`Tables found: ${tables.rowCount}`)
      for (const row of tables.rows) {
        console.log(`  - ${row.table_name}`)
      }

      // Check if Product table exists and count rows
      if (tables.rows.some(r => r.table_name === 'Product')) {
        const count = await client.query(`SELECT COUNT(*) FROM "${schemaName}"."Product"`)
        console.log(`\n  Product count: ${count.rows[0].count}`)
      }

      // List ALL schemas available
      const schemas = await client.query(`
        SELECT schema_name FROM information_schema.schemata 
        WHERE schema_name NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
        ORDER BY schema_name
      `)
      console.log(`\n  Available schemas:`)
      for (const row of schemas.rows) {
        console.log(`    - ${row.schema_name}`)
      }

    } catch (err: any) {
      console.log(`❌ ${tenant.name}: ${err.message}`)
    } finally {
      await client.end()
    }
  }

  await prisma.$disconnect()
}

main().catch(console.error)
