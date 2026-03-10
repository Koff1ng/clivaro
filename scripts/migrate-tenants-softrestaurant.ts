import { Client } from 'pg';
import * as dotenv from 'dotenv';
import path from 'path';

// Load .env from root
dotenv.config({ path: path.join(process.cwd(), '.env') });

async function migrateAllTenants() {
    const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;
    if (!connectionString) {
        console.error('Error: DATABASE_URL o DIRECT_URL no configurados en .env');
        process.exit(1);
    }

    console.log('--- Iniciando migración de todos los tenants (SoftRestaurant Features) ---');

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
            await client.query(`SET search_path TO "${schema}"`);

            const migrationSql = `
                -- Update Product table
                ALTER TABLE "Product" 
                ADD COLUMN IF NOT EXISTS "lastCost" DOUBLE PRECISION DEFAULT 0,
                ADD COLUMN IF NOT EXISTS "averageCost" DOUBLE PRECISION DEFAULT 0,
                ADD COLUMN IF NOT EXISTS "percentageMerma" DOUBLE PRECISION DEFAULT 0,
                ADD COLUMN IF NOT EXISTS "useScale" BOOLEAN NOT NULL DEFAULT false,
                ADD COLUMN IF NOT EXISTS "stockAlertEnabled" BOOLEAN NOT NULL DEFAULT true;

                -- Update ProductVariant table
                ALTER TABLE "ProductVariant" 
                ADD COLUMN IF NOT EXISTS "lastCost" DOUBLE PRECISION DEFAULT 0,
                ADD COLUMN IF NOT EXISTS "averageCost" DOUBLE PRECISION DEFAULT 0,
                ADD COLUMN IF NOT EXISTS "yieldFactor" DOUBLE PRECISION NOT NULL DEFAULT 1;

                -- Ensure yieldFactor is set for existing records if they were partially created
                UPDATE "ProductVariant" SET "yieldFactor" = 1 WHERE "yieldFactor" IS NULL;
            `;

            try {
                await client.query(migrationSql);
                console.log(`✓ Schema ${schema} actualizado correctamente.`);
            } catch (err) {
                console.error(`✗ Error migrando schema ${schema}:`, err.message);
            }
        }

        console.log('\n--- Migración global completada ---');

    } catch (error) {
        console.error('Error fatal durante la migración:', error);
    } finally {
        await client.end();
    }
}

migrateAllTenants();
