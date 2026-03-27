import { PrismaClient } from '@prisma/client'
import { Client } from 'pg'

const prisma = new PrismaClient()

async function main() {
  const tenants = await prisma.tenant.findMany({ where: { active: true } })
  
  for (const tenant of tenants) {
    if (!tenant.databaseUrl) continue

    const client = new Client({ connectionString: tenant.databaseUrl })
    try {
      await client.connect()
      
      let schemaName = 'public'
      try {
        const url = new URL(tenant.databaseUrl)
        schemaName = url.searchParams.get('schema') || 'public'
      } catch (e) {}

      console.log(`\n=== ${tenant.name} (${tenant.slug}) ===`)
      console.log(`  DB URL schema param: ${schemaName}`)
      
      // Check if the schema even exists
      const schemaExists = await client.query(`
        SELECT 1 FROM information_schema.schemata WHERE schema_name = $1
      `, [schemaName])
      console.log(`  Schema "${schemaName}" exists: ${schemaExists.rowCount! > 0}`)

      // Check ALL tenant_ schemas for tables
      const tenantSchemas = await client.query(`
        SELECT schema_name FROM information_schema.schemata 
        WHERE schema_name LIKE 'tenant_%'
        ORDER BY schema_name
      `)
      
      for (const s of tenantSchemas.rows) {
        const tables = await client.query(`
          SELECT COUNT(*) as cnt FROM information_schema.tables 
          WHERE table_schema = $1 AND table_type = 'BASE TABLE'
        `, [s.schema_name])
        const cnt = tables.rows[0].cnt
        if (parseInt(cnt) > 0) {
          console.log(`  Schema ${s.schema_name}: ${cnt} tables`)
          
          // Check if Product table has data
          try {
            const products = await client.query(`SELECT COUNT(*) FROM "${s.schema_name}"."Product"`)
            console.log(`    -> Products: ${products.rows[0].count}`)
          } catch (e) {}
        }
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
