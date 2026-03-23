const { Client } = require('pg');

async function check() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('DATABASE_URL not found');
    process.exit(1);
  }

  const client = new Client({ connectionString: databaseUrl });
  try {
    await client.connect();
    
    console.log('Checking for public.Tenant.adminPassword column...');
    const res = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'Tenant' 
      AND column_name = 'adminPassword'
    `);
    
    if (res.rows.length > 0) {
      console.log('✓ SUCCESS: adminPassword column exists.');
    } else {
      console.log('✗ FAILURE: adminPassword column NOT FOUND.');
      
      console.log('Attempting to add it now...');
      await client.query('ALTER TABLE public."Tenant" ADD COLUMN IF NOT EXISTS "adminPassword" TEXT');
      console.log('✓ Column added.');
    }

  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await client.end();
  }
}

check();
