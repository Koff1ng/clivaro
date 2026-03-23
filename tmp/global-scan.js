const { Client } = require('pg');

async function globalScan() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('DATABASE_URL not found');
    process.exit(1);
  }

  const client = new Client({ connectionString: databaseUrl });
  try {
    await client.connect();
    
    console.log('Global scan for PaymentMethod table...');
    
    const res = await client.query(`
      SELECT table_schema, table_name 
      FROM information_schema.tables 
      WHERE LOWER(table_name) LIKE '%paymentmethod%'
    `);
    
    console.log('Matches found:', JSON.stringify(res.rows, null, 2));

    if (res.rows.length > 0) {
      const match = res.rows[0];
      const colRes = await client.query(`
        SELECT column_name, data_type, is_nullable 
        FROM information_schema.columns 
        WHERE table_schema = $1 AND table_name = $2
      `, [match.table_schema, match.table_name]);
      console.log(`Columns for ${match.table_schema}.${match.table_name}:`, JSON.stringify(colRes.rows, null, 2));
    }

  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await client.end();
  }
}

globalScan();
