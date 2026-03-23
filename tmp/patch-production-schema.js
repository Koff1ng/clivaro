const { Client } = require('pg');
require('dotenv').config();

// Use DIRECT_URL for schema alterations to bypass PgBouncer
const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;

async function patchDatabase() {
  const client = new Client({ connectionString });
  
  try {
    await client.connect();
    console.log('Connected to database natively.');
    
    // Add adminPassword to Tenant table
    console.log('Patching "Tenant" table...');
    await client.query(`ALTER TABLE "public"."Tenant" ADD COLUMN IF NOT EXISTS "adminPassword" TEXT;`);
    console.log('Tenant table patched successfully.');

    // Add forcePasswordChange to User table
    console.log('Patching "User" table...');
    await client.query(`ALTER TABLE "public"."User" ADD COLUMN IF NOT EXISTS "forcePasswordChange" BOOLEAN NOT NULL DEFAULT false;`);
    console.log('User table patched successfully.');

  } catch (error) {
    console.error('Error patching database:', error);
  } finally {
    await client.end();
  }
}

patchDatabase();
