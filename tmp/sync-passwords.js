const { Client } = require('pg');

async function sync() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('DATABASE_URL not found');
    process.exit(1);
  }

  const client = new Client({ connectionString: databaseUrl });
  try {
    await client.connect();
    
    console.log('Synchronizing existing tenant passwords...');
    const res = await client.query(`
      UPDATE public."Tenant" 
      SET "adminPassword" = 'Admin123!' 
      WHERE "adminPassword" IS NULL
    `);
    
    console.log(`✓ SUCCESS: Updated ${res.rowCount} tenants.`);
    
    const checkRes = await client.query('SELECT name, "adminPassword" FROM public."Tenant"');
    console.log('Current status:');
    checkRes.rows.forEach(row => {
      console.log(`  - ${row.name}: ${row.adminPassword || 'NULL'}`);
    });

  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await client.end();
  }
}

sync();
