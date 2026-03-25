/**
 * Migration: Add PurchaseOrderAttachment table to all tenant schemas.
 * This is an ADDITIVE migration — it only creates a new table, no existing data is touched.
 */
import { PrismaClient } from '@prisma/client'

const masterPrisma = new PrismaClient()

const CREATE_TABLE_SQL = (schema: string) => `
  CREATE TABLE IF NOT EXISTS "${schema}"."PurchaseOrderAttachment" (
    "id"              TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "purchaseOrderId" TEXT NOT NULL,
    "fileName"        TEXT NOT NULL,
    "fileUrl"         TEXT NOT NULL,
    "fileType"        TEXT NOT NULL DEFAULT 'OTRO',
    "fileSize"        INTEGER NOT NULL DEFAULT 0,
    "mimeType"        TEXT NOT NULL DEFAULT 'application/octet-stream',
    "notes"           TEXT,
    "uploadedById"    TEXT,
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PurchaseOrderAttachment_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "PurchaseOrderAttachment_purchaseOrderId_fkey" 
      FOREIGN KEY ("purchaseOrderId") 
      REFERENCES "${schema}"."PurchaseOrder"("id") 
      ON DELETE CASCADE ON UPDATE CASCADE
  );
`

async function main() {
  console.log('🔄 Migrating PurchaseOrderAttachment table to all tenants...\n')

  const tenants = await masterPrisma.tenant.findMany({
    select: { id: true, name: true, slug: true }
  })

  console.log(`Found ${tenants.length} tenants\n`)

  for (const tenant of tenants) {
    const schema = `tenant_${tenant.slug || tenant.id}`
    console.log(`  ➤ ${tenant.name} (${schema})`)

    try {
      await masterPrisma.$executeRawUnsafe(CREATE_TABLE_SQL(schema))
      console.log(`    ✅ PurchaseOrderAttachment table ready`)
    } catch (err: any) {
      console.error(`    ❌ Error: ${err.message}`)
    }
  }

  console.log('\n✅ Migration complete!')
  await masterPrisma.$disconnect()
}

main().catch(console.error)
