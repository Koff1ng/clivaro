const { Client } = require('pg');

const url = 'postgresql://postgres:cartuchera123@db.kkylpwgoxymskhblorsz.supabase.co:5432/postgres';

async function run() {
    console.log('--- Starting migration ---');
    const client = new Client({
        connectionString: url,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();
        const res = await client.query("SELECT schema_name FROM information_schema.schemata WHERE schema_name LIKE 'tenant_%'");
        console.log(`Found ${res.rows.length} schemas`);

        for (const r of res.rows) {
            const s = r.schema_name;
            console.log(`Migrating ${s}...`);

            const queries = [
                `ALTER TABLE "${s}"."Product" ADD COLUMN IF NOT EXISTS "lastCost" DOUBLE PRECISION DEFAULT 0`,
                `ALTER TABLE "${s}"."Product" ADD COLUMN IF NOT EXISTS "averageCost" DOUBLE PRECISION DEFAULT 0`,
                `ALTER TABLE "${s}"."Product" ADD COLUMN IF NOT EXISTS "percentageMerma" DOUBLE PRECISION DEFAULT 0`,
                `ALTER TABLE "${s}"."Product" ADD COLUMN IF NOT EXISTS "stockAlertEnabled" BOOLEAN NOT NULL DEFAULT true`,
                `ALTER TABLE "${s}"."ProductVariant" ADD COLUMN IF NOT EXISTS "lastCost" DOUBLE PRECISION DEFAULT 0`,
                `ALTER TABLE "${s}"."ProductVariant" ADD COLUMN IF NOT EXISTS "averageCost" DOUBLE PRECISION DEFAULT 0`,
                `ALTER TABLE "${s}"."ProductVariant" ADD COLUMN IF NOT EXISTS "yieldFactor" DOUBLE PRECISION NOT NULL DEFAULT 1`
            ];

            for (const q of queries) {
                try {
                    await client.query(q);
                } catch (err) {
                    console.warn(`[${s}] Warning: ${err.message}`);
                }
            }
            console.log(`✓ ${s} done.`);
        }
        console.log('--- Migration finished ---');
    } catch (err) {
        console.error('Fatal error:', err);
    } finally {
        await client.end();
    }
}

run();
