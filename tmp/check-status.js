const { PrismaClient } = require('@prisma/client')

async function check() {
  const p = new PrismaClient()
  
  // Check tenant_prueba invoices with electronic data
  const rows = await p.$queryRawUnsafe(`
    SELECT "number", "electronicStatus", "cufe", "electronicSentAt", 
           substring("electronicResponse" from 1 for 500) as response_preview
    FROM "tenant_prueba"."Invoice" 
    WHERE "electronicStatus" IS NOT NULL OR "cufe" IS NOT NULL
    ORDER BY "createdAt" DESC
    LIMIT 5
  `)
  
  console.log('Invoices with electronic data:')
  for (const r of rows) {
    console.log(`  ${r.number}: status=${r.electronicStatus}, cufe=${r.cufe?.substring(0,30)}...`)
    console.log(`    sentAt=${r.electronicSentAt}`)
    if (r.response_preview) {
      console.log(`    response: ${r.response_preview}`)
    }
  }
  
  await p.$disconnect()
}

check()
