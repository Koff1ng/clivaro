import { PrismaClient } from '@prisma/client'
import { Client } from 'pg'

const prisma = new PrismaClient()

/**
 * Renames existing tenant schemas from `tenant_{cuid}` to `tenant_{slug}`.
 * Also updates the databaseUrl field in each Tenant record.
 * This makes schemas human-readable in the database.
 */
async function main() {
  const baseUrl = process.env.DATABASE_URL || process.env.DIRECT_URL || ''
  if (!baseUrl) throw new Error('DATABASE_URL is required')

  const tenants = await prisma.tenant.findMany()
  console.log(`Found ${tenants.length} tenants to migrate\n`)

  for (const tenant of tenants) {
    const oldSchema = `tenant_${tenant.id.toLowerCase().replace(/[^a-z0-9]/g, '_')}`
    const newSchema = `tenant_${tenant.slug.toLowerCase().replace(/[^a-z0-9]/g, '_')}`

    console.log(`--- ${tenant.name} ---`)
    console.log(`  Old: ${oldSchema}`)
    console.log(`  New: ${newSchema}`)

    if (oldSchema === newSchema) {
      console.log(`  ⏩ Already using slug-based name, skipping\n`)
      continue
    }

    const client = new Client({ connectionString: baseUrl })
    await client.connect()

    try {
      // Check if old schema exists
      const oldExists = await client.query(
        `SELECT 1 FROM information_schema.schemata WHERE schema_name = $1`, [oldSchema]
      )

      if (!oldExists.rowCount || oldExists.rowCount === 0) {
        console.log(`  ⚠️ Old schema does not exist, skipping`)
        // Check if new schema already exists
        const newExists = await client.query(
          `SELECT 1 FROM information_schema.schemata WHERE schema_name = $1`, [newSchema]
        )
        if (newExists.rowCount && newExists.rowCount > 0) {
          console.log(`  ✅ New schema already exists!`)
        } else {
          console.log(`  ❌ Neither old nor new schema exists!`)
        }
        await client.end()
        continue
      }

      // Check if new schema already exists (conflict)
      const newExists = await client.query(
        `SELECT 1 FROM information_schema.schemata WHERE schema_name = $1`, [newSchema]
      )
      if (newExists.rowCount && newExists.rowCount > 0) {
        console.log(`  ⚠️ New schema already exists, skipping to avoid conflict\n`)
        await client.end()
        continue
      }

      // Rename the schema
      await client.query(`ALTER SCHEMA "${oldSchema}" RENAME TO "${newSchema}"`)
      console.log(`  ✅ Schema renamed successfully`)

      // Update the databaseUrl in the Tenant record
      const newUrl = new URL(baseUrl)
      newUrl.searchParams.set('schema', newSchema)
      await prisma.tenant.update({
        where: { id: tenant.id },
        data: { databaseUrl: newUrl.toString() }
      })
      console.log(`  ✅ Tenant databaseUrl updated`)

    } catch (e: any) {
      console.log(`  ❌ Error: ${e.message}`)
    }

    await client.end()
    console.log()
  }

  await prisma.$disconnect()
  console.log('✅ Schema rename migration complete!')
}

main().catch(console.error)
