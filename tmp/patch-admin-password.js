const { Client } = require('pg');
require('dotenv').config();

async function addAdminPasswordColumn() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('DATABASE_URL not found');
    process.exit(1);
  }

  const client = new Client({ connectionString: databaseUrl });
  try {
    await client.connect();
    
    // Add adminPassword to public.Tenant
    await client.query(`
      ALTER TABLE "public"."Tenant" 
      ADD COLUMN IF NOT EXISTS "adminPassword" TEXT;
    `);
    console.log("[OK] Added adminPassword to public.Tenant");
    
  } catch (err) {
    console.error('[ERROR] Failed to patch public.Tenant:', err.message);
  } finally {
    await client.end();
  }
}

addAdminPasswordColumn();
