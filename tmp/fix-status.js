const { PrismaClient } = require('@prisma/client')

async function fix() {
  const p = new PrismaClient()
  
  // Fix existing invoices: if they have a CUFE and status is PENDING, set to ACCEPTED
  const result = await p.$executeRawUnsafe(
    `UPDATE "tenant_prueba"."Invoice" SET "electronicStatus" = 'ACCEPTED' WHERE "cufe" IS NOT NULL AND "electronicStatus" = 'PENDING'`
  )
  console.log('Fixed invoices:', result)
  
  // Verify
  const rows = await p.$queryRawUnsafe(
    `SELECT "number", "electronicStatus", "cufe" FROM "tenant_prueba"."Invoice" WHERE "electronicStatus" IS NOT NULL LIMIT 5`
  )
  for (const r of rows) {
    console.log(`  ${r.number}: ${r.electronicStatus}`)
  }
  
  await p.$disconnect()
}

fix()
