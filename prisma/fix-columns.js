const { Client } = require('pg');
require('dotenv').config();

async function fix() {
    const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;
    if (!connectionString) {
        console.error('DATABASE_URL not found');
        process.exit(1);
    }

    const client = new Client({
        connectionString,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();
        const res = await client.query("SELECT schema_name FROM information_schema.schemata WHERE schema_name LIKE 'tenant_%'");
        const schemas = res.rows.map(r => r.schema_name);
        console.log(`Found ${schemas.length} schemas`);

        for (const schema of schemas) {
            console.log(`Fixing ${schema}...`);
            await client.query(`ALTER TABLE "${schema}"."Product" ADD COLUMN IF NOT EXISTS "lastCost" DOUBLE PRECISION DEFAULT 0`);
            await client.query(`ALTER TABLE "${schema}"."Product" ADD COLUMN IF NOT EXISTS "averageCost" DOUBLE PRECISION DEFAULT 0`);
            await client.query(`ALTER TABLE "${schema}"."Product" ADD COLUMN IF NOT EXISTS "percentageMerma" DOUBLE PRECISION DEFAULT 0`);
            await client.query(`ALTER TABLE "${schema}"."Product" ADD COLUMN IF NOT EXISTS "stockAlertEnabled" BOOLEAN NOT NULL DEFAULT true`);

            await client.query(`ALTER TABLE "${schema}"."ProductVariant" ADD COLUMN IF NOT EXISTS "lastCost" DOUBLE PRECISION DEFAULT 0`);
            await client.query(`ALTER TABLE "${schema}"."ProductVariant" ADD COLUMN IF NOT EXISTS "averageCost" DOUBLE PRECISION DEFAULT 0`);
            await client.query(`ALTER TABLE "${schema}"."ProductVariant" ADD COLUMN IF NOT EXISTS "yieldFactor" DOUBLE PRECISION NOT NULL DEFAULT 1`);
            console.log(`Done with ${schema}`);
        }
    } catch (err) {
        console.error(err);
    } finally {
        await client.end();
    }
}

fix();
