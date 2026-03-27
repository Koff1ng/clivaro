const { PrismaClient } = require('@prisma/client')

async function check() {
  const p = new PrismaClient()
  
  const rows = await p.$queryRawUnsafe(`
    SELECT "number", "electronicStatus", "electronicResponse"
    FROM "tenant_prueba"."Invoice" 
    WHERE "electronicStatus" IS NOT NULL
    LIMIT 3
  `)
  
  for (const r of rows) {
    console.log(`=== ${r.number} (status: ${r.electronicStatus}) ===`)
    if (r.electronicResponse) {
      try {
        const parsed = JSON.parse(r.electronicResponse)
        // Look for the bill status in the response
        const bill = parsed?.data?.bill || parsed?.bill
        if (bill) {
          console.log('  bill.status:', bill.status)
          console.log('  bill.validated:', bill.validated)
          console.log('  bill.cufe:', bill.cufe?.substring(0, 30) + '...')
        } else {
          // Maybe the response is the full factus response
          console.log('  Full response keys:', Object.keys(parsed))
          console.log('  status:', parsed.status)
          console.log('  message:', parsed.message)
          if (parsed.data) {
            console.log('  data keys:', Object.keys(parsed.data))
            if (parsed.data.bill) {
              console.log('  data.bill.status:', parsed.data.bill.status)
            }
          }
        }
      } catch (e) {
        console.log('  Raw response:', r.electronicResponse?.substring(0, 300))
      }
    }
  }
  
  await p.$disconnect()
}

check()
