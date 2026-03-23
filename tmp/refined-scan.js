const { Client } = require('pg');

async function refinedScan() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('DATABASE_URL not found');
    process.exit(1);
  }

  const client = new Client({ connectionString: databaseUrl });
  try {
    await client.connect();
    
    console.log('Refined global scan for PaymentMethod...');
    
    const res = await client.query(`
      SELECT table_schema, table_name 
      FROM information_schema.tables 
      WHERE LOWER(table_name) = 'paymentmethod'
    `);
    
    for (const row of res.rows) {
      console.log(`FOUND: Schema=[${row.table_schema}] Table=[${row.table_name}]`);
      const colRes = await client.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_schema = $1 AND table_name = $2
      `, [row.table_schema, row.table_name]);
      console.log(`  Columns: ${colRes.rows.map(r => r.column_name).join(', ')}`);
      
      const dataRes = await client.query(`SELECT name FROM "${row.table_schema}"."${row.table_name}"`);
      console.log(`  Existing Names: ${dataRes.rows.map(r => r.name).join(', ')}`);
    }

  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await client.end();
  }
}

refinedScan();
