const { Client } = require('pg');
const fs = require('fs');
const DIRECT_URL = 'postgresql://postgres:cartuchera123@db.kkylpwgoxymskhblorsz.supabase.co:5432/postgres';

async function main() {
    const client = new Client({ connectionString: DIRECT_URL });
    await client.connect();

    const res = await client.query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'Tenant'
    `);
    fs.writeFileSync('tenant-cols.json', JSON.stringify(res.rows, null, 2));
    console.log('Saved to tenant-cols.json');
    await client.end();
}
main().catch(console.error);
