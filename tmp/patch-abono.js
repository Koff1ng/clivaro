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
    
    const res = await client.query("SELECT schema_name FROM information_schema.schemata WHERE schema_name LIKE 't_%'");
    const schemas = res.rows.map(r => r.schema_name);
    
    console.log(`Found ${schemas.length} tenant schemas to patch.`);

    for (const schema of schemas) {
      console.log(`Patching schema: ${schema}`);
      try {
        await client.query(`SET search_path TO "${schema}"`);
        
        // 1. If 'ABONO' doesn't exist but 'Crédito' does, rename it
        await client.query(`
          UPDATE "PaymentMethod" 
          SET "name" = 'ABONO' 
          WHERE "name" = 'Crédito' 
          AND NOT EXISTS (SELECT 1 FROM "PaymentMethod" WHERE "name" = 'ABONO');
        `);

        // 2. If 'ABONO' still doesn't exist, create it
        await client.query(`
          INSERT INTO "PaymentMethod" ("id", "name", "type", "active", "color", "icon")
          SELECT gen_random_uuid()::text, 'ABONO', 'CREDIT', true, '#ef4444', 'hand-coins'
          WHERE NOT EXISTS (SELECT 1 FROM "PaymentMethod" WHERE "name" = 'ABONO');
        `);
        
        console.log(`  ✓ Schema ${schema} updated to use 'ABONO'.`);
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
