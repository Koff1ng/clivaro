const { Client } = require('pg');

const DIRECT_URL = 'postgresql://postgres:cartuchera123@db.kkylpwgoxymskhblorsz.supabase.co:5432/postgres';

const COLUMNS_TO_CHECK = [
    { table: 'Product', column: 'preferredZoneId', type: 'TEXT' },
    { table: 'InvoiceItem', column: 'updatedAt', type: 'TIMESTAMP' },
    { table: 'Invoice', column: 'balance', type: 'DOUBLE PRECISION' },
    { table: 'StockLevel', column: 'createdAt', type: 'TIMESTAMP' },
    { table: 'StockMovement', column: 'updatedAt', type: 'TIMESTAMP' },
    // Missing Invoice columns
    { table: 'Invoice', column: 'alegraInvoiceId', type: 'TEXT' },
    { table: 'Invoice', column: 'cufe', type: 'TEXT' },
    { table: 'Invoice', column: 'qrCode', type: 'TEXT' },
    { table: 'Invoice', column: 'electronicStatus', type: 'TEXT' },
    { table: 'Invoice', column: 'electronicSentAt', type: 'TIMESTAMP' },
    { table: 'Invoice', column: 'electronicResponse', type: 'TEXT' },
    { table: 'Invoice', column: 'resolutionNumber', type: 'TEXT' },
    // Missing Customer columns
    { table: 'Customer', column: 'currentBalance', type: 'DOUBLE PRECISION' },
    { table: 'Customer', column: 'idType', type: 'TEXT' },
    { table: 'Customer', column: 'isCompany', type: 'BOOLEAN' },
    { table: 'Customer', column: 'taxRegime', type: 'TEXT' },
];

async function main() {
    const client = new Client({ connectionString: DIRECT_URL });
    await client.connect();

    const tenantRes = await client.query(`SELECT id, slug FROM public."Tenant"`);
    console.log(`Found ${tenantRes.rows.length} valid tenants.`);

    for (const tenant of tenantRes.rows) {
        const schema = `tenant_${tenant.id}`;
        console.log(`\nVerifying schema: ${schema} (slug: ${tenant.slug})`);

        // Check if schema exists
        const schemaExists = await client.query(`
            SELECT schema_name 
            FROM information_schema.schemata 
            WHERE schema_name = $1
        `, [schema]);

        if (schemaExists.rows.length === 0) {
            console.log(`❌ Schema ${schema} DOES NOT EXIST!`);
            continue;
        }

        // Check columns
        for (const check of COLUMNS_TO_CHECK) {
            try {
                const colRes = await client.query(`
                    SELECT column_name 
                    FROM information_schema.columns 
                    WHERE table_schema = $1 AND table_name = $2 AND column_name = $3
                `, [schema, check.table, check.column]);

                if (colRes.rows.length === 0) {
                    console.log(`⚠️ Missing column: ${check.table}.${check.column}`);
                    // Fix it automatically
                    console.log(`  -> Fixing: ALTER TABLE "${schema}"."${check.table}" ADD COLUMN "${check.column}" ${check.type}`);
                    try {
                        let defaultClause = '';
                        if (check.type === 'TIMESTAMP') defaultClause = ' DEFAULT NOW()';
                        if (check.type === 'DOUBLE PRECISION') defaultClause = ' DEFAULT 0';
                        if (check.type === 'BOOLEAN') defaultClause = ' DEFAULT false';

                        await client.query(`ALTER TABLE "${schema}"."${check.table}" ADD COLUMN "${check.column}" ${check.type} ${defaultClause}`);
                        console.log(`  ✅ Fixed.`);
                    } catch (fixErr) {
                        console.log(`  ❌ Failed to fix: ${fixErr.message}`);
                    }
                } else {
                    console.log(`✅ OK: ${check.table}.${check.column}`);
                }
            } catch (err) {
                console.log(`Error checking ${check.table}.${check.column}: ${err.message}`);
            }
        }
    }

    await client.end();
}

main().catch(console.error);
