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
    
    // Get all schemas that look like tenants (prefixed with 't_')
    const res = await client.query("SELECT schema_name FROM information_schema.schemata WHERE schema_name LIKE 't_%'");
    const schemas = res.rows.map(r => r.schema_name);
    
    console.log(`Found ${schemas.length} tenant schemas to patch.`);

    for (const schema of schemas) {
      console.log(`Patching schema: ${schema}`);
      try {
        await client.query(`SET search_path TO "${schema}"`);
        
        // Insert 'Crédito' if not exists
        await client.query(`
          INSERT INTO "PaymentMethod" ("id", "name", "type", "active", "color", "icon")
          VALUES (gen_random_uuid()::text, 'Crédito', 'CREDIT', true, '#ef4444', 'hand-coins')
          ON CONFLICT ("name") DO NOTHING;
        `);
        console.log(`  ✓ Schema ${schema} patched.`);
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
