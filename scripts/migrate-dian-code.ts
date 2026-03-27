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

      // Check if PaymentMethod table exists
      const tableExists = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = $1 AND table_name = 'PaymentMethod'
        )
      `, [schemaName])

      if (!tableExists.rows[0].exists) {
        console.log(`  ⚠️  PaymentMethod table does not exist`)
        continue
      }

      // Check if dianCode column already exists
      const columnExists = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.columns 
          WHERE table_schema = $1 AND table_name = 'PaymentMethod' AND column_name = 'dianCode'
        )
      `, [schemaName])

      if (columnExists.rows[0].exists) {
        console.log(`  ✅ dianCode column already exists`)
        continue
      }

      // Add the column
      await client.query(`
        ALTER TABLE "${schemaName}"."PaymentMethod" 
        ADD COLUMN "dianCode" TEXT NOT NULL DEFAULT 'ZZZ'
      `)
      console.log(`  ✅ Added dianCode column with default 'ZZZ'`)

      // Auto-set DIAN codes for existing methods based on type
      const result = await client.query(`
        UPDATE "${schemaName}"."PaymentMethod" SET "dianCode" = CASE
          WHEN "type" = 'CASH' THEN '10'
          WHEN "type" = 'CARD' THEN '48'
          WHEN "type" = 'TRANSFER' THEN '47'
          WHEN "type" = 'ELECTRONIC' THEN '31'
          WHEN "type" = 'CREDIT' THEN '72'
          ELSE 'ZZZ'
        END
      `)
      console.log(`  ✅ Updated ${result.rowCount} existing methods with DIAN codes based on type`)

    } catch (err: any) {
      console.log(`  ❌ ${tenant.name}: ${err.message}`)
    } finally {
      await client.end()
    }
  }

  // Also update the master/public schema if PaymentMethod exists
  const masterClient = new Client({ connectionString: process.env.DATABASE_URL })
  try {
    await masterClient.connect()
    const colCheck = await masterClient.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'PaymentMethod' AND column_name = 'dianCode'
      )
    `)
    if (!colCheck.rows[0].exists) {
      await masterClient.query(`
        ALTER TABLE "public"."PaymentMethod" 
        ADD COLUMN "dianCode" TEXT NOT NULL DEFAULT 'ZZZ'
      `)
      console.log(`\n✅ Master schema: Added dianCode column`)
    } else {
      console.log(`\n✅ Master schema: dianCode column already exists`)
    }
  } catch (err: any) {
    console.log(`\n⚠️ Master schema check: ${err.message}`)
  } finally {
    await masterClient.end()
  }

  await prisma.$disconnect()
  console.log('\n✅ Migration complete!')
}

main().catch(console.error)
