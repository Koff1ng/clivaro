import { PrismaClient } from '@prisma/client'
import { Client } from 'pg'

const prisma = new PrismaClient()

async function main() {
  const baseUrl = process.env.DATABASE_URL || process.env.DIRECT_URL || ''
  const tenants = await prisma.tenant.findMany()

  for (const tenant of tenants) {
    const slug = tenant.slug.toLowerCase().replace(/[^a-z0-9]/g, '_')
    const schema = `tenant_${slug}`
    console.log(`\n--- ${tenant.name} (${schema}) ---`)

    const client = new Client({ connectionString: baseUrl })
    await client.connect()
    try {
      await client.query(`SET search_path TO "${schema}"`)
      const abono = await client.query(`SELECT id FROM "PaymentMethod" WHERE name = 'ABONO'`)
      if (abono.rowCount && abono.rowCount > 0) {
        const id = abono.rows[0].id
        const refs = await client.query(`SELECT count(*) as cnt FROM "Payment" WHERE "paymentMethodId" = '${id}'`)
        let shiftRefs = { rows: [{ cnt: '0' }] }
        try {
          shiftRefs = await client.query(`SELECT count(*) as cnt FROM "ShiftSummary" WHERE "paymentMethodId" = '${id}'`)
        } catch (e) { /* table might not exist */ }

        if (parseInt(refs.rows[0].cnt) === 0 && parseInt(shiftRefs.rows[0].cnt) === 0) {
          await client.query(`DELETE FROM "PaymentMethod" WHERE id = '${id}'`)
          console.log('  ✅ Deleted ABONO payment method')
        } else {
          await client.query(`UPDATE "PaymentMethod" SET active = false WHERE id = '${id}'`)
          console.log(`  ⚠️ Deactivated ABONO (has ${refs.rows[0].cnt} payment refs)`)
        }
      } else {
        console.log('  ℹ️ No ABONO found')
      }
    } catch (e: any) {
      console.log(`  ❌ Error: ${e.message}`)
    }
    await client.end()
  }
  await prisma.$disconnect()
  console.log('\n✅ Done!')
}

main().catch(console.error)
