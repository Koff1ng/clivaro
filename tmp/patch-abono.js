const { Client } = require('pg');

async function patchAllSchemas() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('DATABASE_URL not found');
    process.exit(1);
  }

  const client = new Client({ connectionString: databaseUrl });
  try {
    await client.connect();
    
    // The refined scan showed the schemas are named 'tenant_%'
    const res = await client.query("SELECT schema_name FROM information_schema.schemata WHERE schema_name LIKE 'tenant_%'");
    const schemas = res.rows.map(r => r.schema_name);
    
    console.log(`Found ${schemas.length} tenant schemas to patch: ${schemas.join(', ')}`);

    for (const schema of schemas) {
      console.log(`Patching schema: ${schema}`);
      try {
        await client.query(`SET search_path TO "${schema}"`);
        
        // Fetch the tenantId from the local Tenant table
        const tenantRes = await client.query('SELECT id FROM "Tenant" LIMIT 1');
        if (tenantRes.rows.length === 0) {
          console.warn(`  ! No tenant ID found in ${schema}, skipping.`);
          continue;
        }
        const tenantId = tenantRes.rows[0].id;

        // 1. Rename 'Crédito' to 'ABONO' if it exists
        await client.query(`
          UPDATE "PaymentMethod" 
          SET "name" = 'ABONO' 
          WHERE "name" = 'Crédito' 
          AND NOT EXISTS (SELECT 1 FROM "PaymentMethod" WHERE "name" = 'ABONO');
        `);

        // 2. Insert 'ABONO' if still not exists, using correct tenantId
        await client.query(`
          INSERT INTO "PaymentMethod" ("id", "name", "type", "active", "color", "icon", "tenantId")
          SELECT gen_random_uuid()::text, 'ABONO', 'CREDIT', true, '#ef4444', 'hand-coins', $1
          WHERE NOT EXISTS (SELECT 1 FROM "PaymentMethod" WHERE "name" = 'ABONO');
        `, [tenantId]);
        
        console.log(`  ✓ Schema ${schema} updated to use 'ABONO' (Tenant: ${tenantId}).`);
      } catch (err) {
        console.error(`  ✗ Error patching ${schema}:`, err.message);
      }
    }
  } catch (err) {
    console.error('Connection error:', err.message);
  } finally {
    await client.end();
  }
}

patchAllSchemas();
