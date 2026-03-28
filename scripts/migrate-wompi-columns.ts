/**
 * Migration script to add Wompi columns to the Subscription table
 * Run: npx tsx scripts/migrate-wompi-columns.ts
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🔄 Adding Wompi columns to Subscription table...')

  const columns = [
    { name: 'wompiTransactionId', type: 'TEXT' },
    { name: 'wompiReference', type: 'TEXT' },
    { name: 'wompiStatus', type: 'TEXT' },
    { name: 'wompiPaymentMethod', type: 'TEXT' },
    { name: 'wompiResponse', type: 'TEXT' },
  ]

  for (const col of columns) {
    try {
      await prisma.$executeRawUnsafe(
        `ALTER TABLE "Subscription" ADD COLUMN IF NOT EXISTS "${col.name}" ${col.type}`
      )
      console.log(`  ✅ ${col.name} — added (or already exists)`)
    } catch (error: any) {
      if (error.message?.includes('already exists')) {
        console.log(`  ⏩ ${col.name} — already exists, skipping`)
      } else {
        console.error(`  ❌ ${col.name} — error:`, error.message)
      }
    }
  }

  console.log('\n✅ Done. Wompi columns are ready.')
}

main()
  .catch((e) => {
    console.error('Migration failed:', e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
