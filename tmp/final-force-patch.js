const { Client } = require('pg');

async function finalForcePatch() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('DATABASE_URL not found');
    process.exit(1);
  }

  const client = new Client({ connectionString: databaseUrl });
  try {
    await client.connect();
    
    // 1. Get all tenants from public
    const tenantsRes = await client.query('SELECT id, slug FROM public."Tenant"');
    const tenants = tenantsRes.rows;
    console.log(`Found ${tenants.length} tenants in public.`);

    for (const tenant of tenants) {
      const schema = `tenant_${tenant.id}`;
      console.log(`Processing schema: ${schema} [${tenant.slug}]`);
      
      try {
        // Ensure schema exists (it should)
        await client.query(`SET search_path TO "${schema}"`);

        // Check if table exists
        const tableCheck = await client.query(`
          SELECT 1 FROM information_schema.tables 
          WHERE table_schema = $1 AND table_name = 'PaymentMethod'
        `, [schema]);

        if (tableCheck.rows.length === 0) {
          console.log(`  ! Table "PaymentMethod" MISSING. Creating...`);
          await client.query(`
            CREATE TABLE "PaymentMethod" (
              "id" TEXT NOT NULL,
              "name" TEXT NOT NULL,
              "type" TEXT NOT NULL DEFAULT 'ELECTRONIC',
              "active" BOOLEAN NOT NULL DEFAULT true,
              "color" TEXT,
              "icon" TEXT,
              "config" TEXT,
              "tenantId" TEXT,
              "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
              "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
              CONSTRAINT "PaymentMethod_pkey" PRIMARY KEY ("id")
            );
            CREATE UNIQUE INDEX "PaymentMethod_name_key" ON "PaymentMethod"("name");
          `);
        }

        // Check if tenantId column exists (safety)
        const columnCheck = await client.query(`
          SELECT 1 FROM information_schema.columns 
          WHERE table_schema = $1 AND table_name = 'PaymentMethod' AND column_name = 'tenantId'
        `, [schema]);

        if (columnCheck.rows.length === 0) {
          console.log(`  ! Column "tenantId" MISSING in "PaymentMethod". Adding...`);
          await client.query(`ALTER TABLE "PaymentMethod" ADD COLUMN "tenantId" TEXT;`);
        }

        // Perform the patch
        // 1. Rename 'Crédito' to 'ABONO' if it exists
        await client.query(`
          UPDATE "PaymentMethod" 
          SET "name" = 'ABONO' 
          WHERE "name" = 'Crédito' 
          AND NOT EXISTS (SELECT 1 FROM "PaymentMethod" WHERE "name" = 'ABONO');
        `);

        // 2. Insert 'ABONO' if still not exists
        await client.query(`
          INSERT INTO "PaymentMethod" ("id", "name", "type", "active", "color", "icon", "tenantId", "updatedAt")
          SELECT gen_random_uuid()::text, 'ABONO', 'CREDIT', true, '#ef4444', 'hand-coins', $1, CURRENT_TIMESTAMP
          WHERE NOT EXISTS (SELECT 1 FROM "PaymentMethod" WHERE "name" = 'ABONO');
        `, [tenant.id]);

        console.log(`  ✓ Schema ${schema} synchronized.`);

      } catch (err) {
        console.error(`  ✗ Error in ${schema}:`, err.message);
      }
    }

  } catch (err) {
    console.error('Global Error:', err.message);
  } finally {
    await client.end();
  }
}

finalForcePatch();
