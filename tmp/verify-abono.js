const { Client } = require('pg');

async function verify() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('DATABASE_URL not found');
    process.exit(1);
  }

  const client = new Client({ connectionString: databaseUrl });
  try {
    await client.connect();
    
    // The refined scan confirmed this prefix
    const schema = 'tenant_cmmirnniw0000ceqllfbm7kiv';
    console.log(`Verifying 'ABONO' in schema: ${schema}`);
    
    await client.query(`SET search_path TO "${schema}"`);
    const res = await client.query('SELECT name, type, active, "tenantId" FROM "PaymentMethod" WHERE name = \'ABONO\'');
    
    if (res.rows.length > 0) {
      console.log('✓ SUCCESS: ABONO found:', JSON.stringify(res.rows[0]));
    } else {
      console.log('✗ FAILURE: ABONO NOT FOUND.');
    }

  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await client.end();
  }
}

verify();
