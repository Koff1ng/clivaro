const { Client } = require('pg');
const dotenv = require('dotenv');
const path = require('path');

// Load .env from root
dotenv.config({ path: path.join(process.cwd(), '.env') });

async function migrateAllTenants() {
    const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;
    if (!connectionString) {
        console.error('Error: DATABASE_URL o DIRECT_URL no configurados en .env');
        process.exit(1);
    }

    console.log('--- Iniciando migración de todos los tenants JS (SoftRestaurant Features) ---');

    const client = new Client({
        connectionString,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();

        // 1. Get all tenant schemas
        const res = await client.query(`
            SELECT schema_name 
            FROM information_schema.schemata 
            WHERE schema_name LIKE 'tenant_%'
        `);

        const schemas = res.rows.map(r => r.schema_name);
        console.log(`Encontrados ${schemas.length} schemas de tenants.`);

        for (const schema of schemas) {
            console.log(`\nMigrando schema: ${schema}...`);

            // Note: Postgres doesn't support multiple ALTER statements with ADD COLUMN IF NOT EXISTS in a single command effectively sometimes, 
            // so we do them individually or wrapped in a block.

            const queries = [
                `ALTER TABLE "${schema}"."Product" ADD COLUMN IF NOT EXISTS "lastCost" DOUBLE PRECISION DEFAULT 0`,
                `ALTER TABLE "${schema}"."Product" ADD COLUMN IF NOT EXISTS "averageCost" DOUBLE PRECISION DEFAULT 0`,
                `ALTER TABLE "${schema}"."Product" ADD COLUMN IF NOT EXISTS "percentageMerma" DOUBLE PRECISION DEFAULT 0`,
                `ALTER TABLE "${schema}"."Product" ADD COLUMN IF NOT EXISTS "useScale" BOOLEAN NOT NULL DEFAULT false`,
                `ALTER TABLE "${schema}"."Product" ADD COLUMN IF NOT EXISTS "stockAlertEnabled" BOOLEAN NOT NULL DEFAULT true`,

                `ALTER TABLE "${schema}"."ProductVariant" ADD COLUMN IF NOT EXISTS "lastCost" DOUBLE PRECISION DEFAULT 0`,
                `ALTER TABLE "${schema}"."ProductVariant" ADD COLUMN IF NOT EXISTS "averageCost" DOUBLE PRECISION DEFAULT 0`,
                `ALTER TABLE "${schema}"."ProductVariant" ADD COLUMN IF NOT EXISTS "yieldFactor" DOUBLE PRECISION NOT NULL DEFAULT 1`,

                `UPDATE "${schema}"."ProductVariant" SET "yieldFactor" = 1 WHERE "yieldFactor" IS NULL`
            ];

            for (const q of queries) {
                try {
                    await client.query(q);
                } catch (err) {
                    console.warn(`[${schema}] Warning on query: ${q.substring(0, 50)}... -> ${err.message}`);
                }
            }
            console.log(`✓ Schema ${schema} procesado.`);
        }

        console.log('\n--- Migración global completada ---');

    } catch (error) {
        console.error('Error fatal durante la migración:', error);
    } finally {
        await client.end();
    }
}

migrateAllTenants();
