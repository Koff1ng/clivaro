const { Client } = require('pg');
require('dotenv').config();

async function run() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('DATABASE_URL not found');
    process.exit(1);
  }

  const client = new Client({ connectionString: databaseUrl });
  try {
    await client.connect();
    
    // Get all tenant schemas
    const res = await client.query(`
      SELECT schema_name 
      FROM information_schema.schemata 
      WHERE schema_name LIKE 'tenant_%'
    `);
    
    console.log(`Found ${res.rowCount} tenant schemas. Patching User table...\\n`);

    for (const row of res.rows) {
      const schemaName = row.schema_name;
      try {
        await client.query(`
          ALTER TABLE "${schemaName}"."User" 
          ADD COLUMN IF NOT EXISTS "forcePasswordChange" BOOLEAN DEFAULT false;
        `);
        console.log(`[OK] Patched schema: ${schemaName}`);
      } catch (err) {
        console.error(`[ERROR] Failed to patch schema ${schemaName}:`, err.message);
      }
    }
    
    console.log('\\nAll schemas patched successfully.');

  } catch (err) {
    console.error('Connection error:', err.message);
  } finally {
    await client.end();
  }
}

run();
