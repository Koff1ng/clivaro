import { loadEnvConfig } from '@next/env'
loadEnvConfig(process.cwd())
import { Client } from 'pg'
import { getSchemaName } from './lib/tenant-utils'
import { prisma } from './lib/db'

async function repairTenant(schemaName: string, client: Client) {
    console.log(`\n[REPAIR] Schema: ${schemaName}`)

    // 1. Create PaymentMethod table if it doesn't exist
    await client.query(`
    CREATE TABLE IF NOT EXISTS "${schemaName}"."PaymentMethod" (
      "id"        TEXT          NOT NULL,
      "name"      TEXT          NOT NULL,
      "type"      TEXT          NOT NULL DEFAULT 'ELECTRONIC',
      "active"    BOOLEAN       NOT NULL DEFAULT true,
      "color"     TEXT,
      "icon"      TEXT,
      "config"    TEXT,
      "createdAt" TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "PaymentMethod_pkey" PRIMARY KEY ("id")
    );
  `)

    // 2. Add UNIQUE constraint on name if not exists
    await client.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE schemaname = '${schemaName}' AND tablename = 'PaymentMethod' AND indexname = 'PaymentMethod_name_key'
      ) THEN
        CREATE UNIQUE INDEX "PaymentMethod_name_key" ON "${schemaName}"."PaymentMethod"("name");
      END IF;
    END $$;
  `)
    console.log(`  ✓ PaymentMethod table ready`)

    // 3. Add paymentMethodId column to Payment table if it doesn't exist
    await client.query(`
    ALTER TABLE "${schemaName}"."Payment" 
    ADD COLUMN IF NOT EXISTS "paymentMethodId" TEXT;
  `)
    console.log(`  ✓ Payment.paymentMethodId column ready`)

    // 4. Add FK constraint if not exists
    await client.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_schema = '${schemaName}' 
        AND table_name = 'Payment' 
        AND constraint_name = 'Payment_paymentMethodId_fkey'
      ) THEN
        ALTER TABLE "${schemaName}"."Payment"
        ADD CONSTRAINT "Payment_paymentMethodId_fkey"
        FOREIGN KEY ("paymentMethodId") REFERENCES "${schemaName}"."PaymentMethod"("id") ON DELETE SET NULL ON UPDATE CASCADE;
      END IF;
    END $$;
  `)
    console.log(`  ✓ FK constraint ready`)

    // 5. Seed default payment methods if table is empty
    const count = await client.query(`SELECT count(*) FROM "${schemaName}"."PaymentMethod"`)
    if (count.rows[0].count === '0') {
        await client.query(`
      INSERT INTO "${schemaName}"."PaymentMethod" ("id", "name", "type", "active", "color", "icon", "updatedAt")
      VALUES 
        (gen_random_uuid()::text, 'Efectivo', 'CASH', true, '#22c55e', 'banknote', NOW()),
        (gen_random_uuid()::text, 'Tarjeta de Crédito', 'CARD', true, '#3b82f6', 'credit-card', NOW()),
        (gen_random_uuid()::text, 'Transferencia', 'TRANSFER', true, '#8b5cf6', 'building-2', NOW()),
        (gen_random_uuid()::text, 'Nequi', 'ELECTRONIC', true, '#ec4899', 'smartphone', NOW())
      ON CONFLICT (name) DO NOTHING;
    `)
        console.log(`  ✓ Default payment methods seeded`)
    } else {
        console.log(`  ℹ Payment methods already exist (${count.rows[0].count})`)
    }
}

async function main() {
    const tenants = await prisma.tenant.findMany({ select: { id: true, slug: true } })
    const client = new Client({ connectionString: process.env.DATABASE_URL || process.env.DIRECT_URL })
    await client.connect()

    for (const tenant of tenants) {
        const schemaName = getSchemaName(tenant.id)
        try {
            await repairTenant(schemaName, client)
        } catch (err: any) {
            console.error(`[ERROR] Schema ${schemaName}:`, err.message)
        }
    }

    await client.end()
    console.log('\n[DONE] All tenants repaired.')
}

main().catch(console.error)
