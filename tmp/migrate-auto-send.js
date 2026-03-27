const { PrismaClient } = require('@prisma/client')

async function migrate() {
  const prisma = new PrismaClient()

  try {
    console.log('Adding autoSendElectronic column...')
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "public"."TenantSettings"
      ADD COLUMN IF NOT EXISTS "autoSendElectronic" BOOLEAN DEFAULT false
    `)
    console.log('Done: public schema')

    const schemas = await prisma.$queryRawUnsafe(`
      SELECT schema_name FROM information_schema.schemata
      WHERE schema_name LIKE 'tenant_%'
    `)

    for (const row of schemas) {
      try {
        await prisma.$executeRawUnsafe(`
          ALTER TABLE "${row.schema_name}"."TenantSettings"
          ADD COLUMN IF NOT EXISTS "autoSendElectronic" BOOLEAN DEFAULT false
        `)
        console.log('Done: ' + row.schema_name)
      } catch (e) {
        console.log('Skip ' + row.schema_name + ': ' + e.message)
      }
    }

    console.log('Migration complete!')
  } catch (error) {
    console.error('Migration failed:', error.message)
  } finally {
    await prisma.$disconnect()
  }
}

migrate()
