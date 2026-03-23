const { Client } = require('pg');

async function checkColumns() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('DATABASE_URL not found');
    process.exit(1);
  }

  const client = new Client({ connectionString: databaseUrl });
  try {
    await client.connect();
    
    const schema = 't_cmmirnniw0000ceqllfbm7kiv';
    console.log(`Auditing schema: ${schema}`);
    
    // List all tables first to be sure
    const tablesRes = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = $1
    `, [schema]);
    console.log('Tables found:', tablesRes.rows.map(r => r.table_name).join(', '));

    const res = await client.query(`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_schema = $1 AND LOWER(table_name) = 'paymentmethod'
    `, [schema]);
    
    console.log('PaymentMethod Columns:', JSON.stringify(res.rows, null, 2));

  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await client.end();
  }
}

checkColumns();
