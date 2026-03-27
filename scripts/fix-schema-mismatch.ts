import { PrismaClient } from '@prisma/client'
import { Client } from 'pg'

const prisma = new PrismaClient()

async function main() {
  const baseUrl = process.env.DATABASE_URL || process.env.DIRECT_URL || ''
  const client = new Client({ connectionString: baseUrl })
  await client.connect()

  const tenants = await prisma.tenant.findMany()
  
  for (const tenant of tenants) {
    const oldSchema = `tenant_${tenant.id.toLowerCase().replace(/[^a-z0-9]/g, '_')}`
    const newSchema = `tenant_${tenant.slug.toLowerCase().replace(/[^a-z0-9]/g, '_')}`

    console.log(`\n--- ${tenant.name} (slug: ${tenant.slug}) ---`)
    console.log(`  Old schema: ${oldSchema}`)
    console.log(`  New schema: ${newSchema}`)

    // Check both schemas
    const oldExists = await client.query(
      `SELECT schema_name FROM information_schema.schemata WHERE schema_name = $1`, [oldSchema]
    )
    const newExists = await client.query(
      `SELECT schema_name FROM information_schema.schemata WHERE schema_name = $1`, [newSchema]
    )

    console.log(`  Old exists: ${(oldExists.rowCount || 0) > 0}`)
    console.log(`  New exists: ${(newExists.rowCount || 0) > 0}`)

    // Check table count in each
    if (oldExists.rowCount && oldExists.rowCount > 0) {
      const oldTables = await client.query(
        `SELECT count(*) as cnt FROM information_schema.tables WHERE table_schema = $1`, [oldSchema]
      )
      const oldProducts = await client.query(
        `SELECT count(*) as cnt FROM "${oldSchema}"."Product"` 
      ).catch(() => ({ rows: [{ cnt: '0' }] }))
      console.log(`  Old tables: ${oldTables.rows[0].cnt}, Products: ${oldProducts.rows[0].cnt}`)
    }

    if (newExists.rowCount && newExists.rowCount > 0) {
      const newTables = await client.query(
        `SELECT count(*) as cnt FROM information_schema.tables WHERE table_schema = $1`, [newSchema]
      )
      const newProducts = await client.query(
        `SELECT count(*) as cnt FROM "${newSchema}"."Product"`
      ).catch(() => ({ rows: [{ cnt: '0' }] }))
      console.log(`  New tables: ${newTables.rows[0].cnt}, Products: ${newProducts.rows[0].cnt}`)
    }

    // If BOTH exist and old has data but new doesn't, fix it
    if (oldExists.rowCount && oldExists.rowCount > 0 && newExists.rowCount && newExists.rowCount > 0 && oldSchema !== newSchema) {
      const oldProducts = await client.query(
        `SELECT count(*) as cnt FROM "${oldSchema}"."Product"`
      ).catch(() => ({ rows: [{ cnt: '0' }] }))
      const newProducts = await client.query(
        `SELECT count(*) as cnt FROM "${newSchema}"."Product"`
      ).catch(() => ({ rows: [{ cnt: '0' }] }))

      const oldCount = parseInt(oldProducts.rows[0].cnt)
      const newCount = parseInt(newProducts.rows[0].cnt)

      if (oldCount > 0 && newCount === 0) {
        console.log(`\n  ⚠️ DATA MISMATCH: Old schema has ${oldCount} products, new has 0`)
        console.log(`  🔧 Fixing: Drop empty new schema, rename old to new`)
        
        // Drop the empty new schema
        await client.query(`DROP SCHEMA "${newSchema}" CASCADE`)
        console.log(`  ✅ Dropped empty "${newSchema}"`)
        
        // Rename old to new
        await client.query(`ALTER SCHEMA "${oldSchema}" RENAME TO "${newSchema}"`)
        console.log(`  ✅ Renamed "${oldSchema}" → "${newSchema}"`)

        // Update databaseUrl
        const newUrl = new URL(baseUrl)
        newUrl.searchParams.set('schema', newSchema)
        await prisma.tenant.update({
          where: { id: tenant.id },
          data: { databaseUrl: newUrl.toString() }
        })
        console.log(`  ✅ Updated databaseUrl`)
      } else if (oldCount === 0 && newCount > 0) {
        console.log(`  ✅ New schema has data, old is empty - correct state`)
      } else {
        console.log(`  ℹ️ Old: ${oldCount} products, New: ${newCount} products`)
      }
    }
  }

  await client.end()
  await prisma.$disconnect()
  console.log('\n✅ Fix complete!')
}

main().catch(console.error)
