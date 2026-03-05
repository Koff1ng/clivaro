const { Client } = require('pg');

const DIRECT_URL = 'postgresql://postgres:cartuchera123@db.kkylpwgoxymskhblorsz.supabase.co:5432/postgres';

async function main() {
  const client = new Client({ connectionString: DIRECT_URL });
  await client.connect();

  // 1. Get all actual schemas in PostgreSQL
  const schemaRes = await client.query(`
    SELECT schema_name 
    FROM information_schema.schemata 
    WHERE schema_name LIKE 'tenant_%'
  `);
  const actualSchemas = schemaRes.rows.map(r => r.schema_name);
  console.log(`Found ${actualSchemas.length} schemas starting with 'tenant_' in DB.`);

  // 2. Get all valid tenants from public table
  const tenantRes = await client.query(`SELECT id, slug FROM public."Tenant"`);
  console.log(`Found ${tenantRes.rows.length} valid tenants in public."Tenant".`);

  const validSchemaNames = new Set(tenantRes.rows.map(r => `tenant_${r.id}`));

  // 3. Find the orphaned ones
  const orphaned = actualSchemas.filter(s => !validSchemaNames.has(s));
  console.log(`Orphaned schemas to be deleted: ${orphaned.length}`);
  if (orphaned.length > 0) {
    console.log(orphaned.join(', '));
    for (const schema of orphaned) {
      console.log(`Dropping schema ${schema}...`);
      await client.query(`DROP SCHEMA "${schema}" CASCADE`);
    }
    console.log('All orphaned schemas dropped successfully.');
  }

  await client.end();
}

main().catch(console.error);
