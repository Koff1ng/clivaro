
const { Client } = require('pg');

async function check() {
    // Direct connection string to avoid env issues
    const connectionString = "postgresql://postgres:cartuchera123@db.kkylpwgoxymskhblorsz.supabase.co:5432/postgres";
    const client = new Client({ connectionString });
    
    try {
        await client.connect();
        console.log('✅ Connected to database');
        
        // Get schemas
        const schemasRes = await client.query("SELECT schema_name FROM information_schema.schemata WHERE schema_name LIKE 'tenant_%'");
        const schemas = schemasRes.rows.map(r => r.schema_name);
        
        console.log(`Found ${schemas.length} tenant schemas`);
        
        for (const schema of schemas) {
            console.log(`\n📦 Checking schema: ${schema}`);
            try {
                // Check if Product table exists first
                const tableExists = await client.query(`SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = '${schema}' AND table_name = 'Product')`);
                if (!tableExists.rows[0].exists) {
                    console.log(`   ❌ Table Product does NOT exist in ${schema}`);
                    continue;
                }

                const countRes = await client.query(`SELECT count(*) FROM "${schema}"."Product"`);
                console.log(`   Products found: ${countRes.rows[0].count}`);
                
                if (parseInt(countRes.rows[0].count) === 0) {
                    console.log('   ⚠️ WARNING: TABLE IS EMPTY');
                } else {
                    const sampleRes = await client.query(`SELECT name FROM "${schema}"."Product" LIMIT 5`);
                    console.log('   Sample names:', sampleRes.rows.map(r => r.name).join(', '));
                }
            } catch (e) {
                console.log(`   ❌ Error checking table: ${e.message}`);
            }
        }
        
    } catch (e) {
        console.error('❌ Connection error:', e.message);
    } finally {
        await client.end();
    }
}

check();
