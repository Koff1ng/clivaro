const { Client } = require('pg');

async function debugPatch() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('DATABASE_URL not found');
    process.exit(1);
  }

  const client = new Client({ connectionString: databaseUrl });
  try {
    await client.connect();
    
    // 1. Get all tenants from public
    console.log('Fetching all tenants from public.Tenant...');
    const tenantsRes = await client.query('SELECT id, slug FROM public."Tenant"');
    const tenants = tenantsRes.rows;
    console.log(`Found ${tenants.length} tenants in public.`);

    // 2. Get all schemas
    const schemasRes = await client.query("SELECT schema_name FROM information_schema.schemata WHERE schema_name LIKE 'tenant_%'");
    const schemas = schemasRes.rows.map(r => r.schema_name);
    console.log(`Found ${schemas.length} tenant schemas.`);

    for (const tenant of tenants) {
      // Find matching schema (usually tenant_[id] or similar)
      const possibleSchema = `tenant_${tenant.id}`;
      if (schemas.includes(possibleSchema)) {
        console.log(`Patching tenant [${tenant.slug}] (ID: ${tenant.id}) in schema [${possibleSchema}]...`);
        try {
          await client.query(`SET search_path TO "${possibleSchema}"`);
          
          // Rename 'Crédito' to 'ABONO' if it exists
          await client.query(`
            UPDATE "PaymentMethod" 
            SET "name" = 'ABONO' 
            WHERE "name" = 'Crédito' 
            AND NOT EXISTS (SELECT 1 FROM "PaymentMethod" WHERE "name" = 'ABONO');
          `);

          // Insert 'ABONO' if still not exists
          await client.query(`
            INSERT INTO "PaymentMethod" ("id", "name", "type", "active", "color", "icon", "tenantId")
            SELECT gen_random_uuid()::text, 'ABONO', 'CREDIT', true, '#ef4444', 'hand-coins', $1
            WHERE NOT EXISTS (SELECT 1 FROM "PaymentMethod" WHERE "name" = 'ABONO');
          `, [tenant.id]);
          
          console.log(`  ✓ Success.`);
        } catch (err) {
          console.error(`  ✗ Error in ${possibleSchema}:`, err.message);
        }
      } else {
        console.log(`  ! No schema found for tenant [${tenant.slug}] (${possibleSchema}). Checking alternative naming...`);
        // Sometimes schema is just t_ or similar, but the user confirmed "Abobo no esta creado"
        // Let's try to find any schema that has this tenantId in its PaymentMethod table? No, it's missing.
      }
    }

  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await client.end();
  }
}

debugPatch();
