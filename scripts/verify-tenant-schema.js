const { Client } = require('pg');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(process.cwd(), '.env') });

async function verifySchema() {
    const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;
    if (!connectionString) {
        console.error('Error: DATABASE_URL o DIRECT_URL no configurados.');
        process.exit(1);
    }

    const client = new Client({
        connectionString,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();

        // Pick one tenant schema to check
        const res = await client.query(`
            SELECT schema_name 
            FROM information_schema.schemata 
            WHERE schema_name LIKE 'tenant_%'
            LIMIT 1
        `);

        if (res.rows.length === 0) {
            console.log('No se encontraron schemas de tenants para verificar.');
            return;
        }

        const schema = res.rows[0].schema_name;
        console.log(`Verificando schema: ${schema}`);

        const columnsRes = await client.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_schema = $1 AND table_name = 'Product'
            AND column_name IN ('lastCost', 'averageCost', 'percentageMerma', 'useScale', 'stockAlertEnabled')
        `, [schema]);

        const foundColumns = columnsRes.rows.map(r => r.column_name);
        console.log(`Columnas encontradas en ${schema}.Product:`, foundColumns);

        const variantColumnsRes = await client.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_schema = $1 AND table_name = 'ProductVariant'
            AND column_name IN ('lastCost', 'averageCost', 'yieldFactor')
        `, [schema]);

        const foundVariantColumns = variantColumnsRes.rows.map(r => r.column_name);
        console.log(`Columnas encontradas en ${schema}.ProductVariant:`, foundVariantColumns);

        if (foundColumns.length === 5 && foundVariantColumns.length === 3) {
            console.log('--- VERIFICACIÓN EXITOSA: Todos los campos están presentes. ---');
        } else {
            console.log('--- VERIFICACIÓN FALLIDA: Faltan algunos campos. ---');
        }

    } catch (error) {
        console.error('Error durante la verificación:', error.message);
    } finally {
        await client.end();
    }
}

verifySchema();
