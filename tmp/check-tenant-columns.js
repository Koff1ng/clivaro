const { Client } = require('pg');
require('dotenv').config();

async function checkTenantTable() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('DATABASE_URL not found');
    process.exit(1);
  }

  const client = new Client({ connectionString: databaseUrl });
  try {
    await client.connect();
    const res = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'Tenant';
    `);
    console.log("Columns in public.Tenant:");
    res.rows.forEach(r => console.log(r.column_name));
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await client.end();
  }
}

checkTenantTable();
