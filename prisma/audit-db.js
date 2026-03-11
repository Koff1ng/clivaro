const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const url = 'postgresql://postgres:cartuchera123@db.kkylpwgoxymskhblorsz.supabase.co:5432/postgres';

async function audit() {
    console.log('--- Starting Comprehensive DB Audit ---');
    const client = new Client({
        connectionString: url,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();

        // 1. Get all tenant schemas
        const schemaRes = await client.query("SELECT schema_name FROM information_schema.schemata WHERE schema_name LIKE 'tenant_%'");
        const schemas = schemaRes.rows.map(r => r.schema_name);
        console.log(`Found ${schemas.length} schemas: ${schemas.join(', ')}`);

        // 2. Define expected columns based on recent findings
        // We can expand this list if we want to check other tables
        const expected = {
            Product: [
                { name: 'lastCost', type: 'double precision' },
                { name: 'averageCost', type: 'double precision' },
                { name: 'percentageMerma', type: 'double precision' },
                { name: 'stockAlertEnabled', type: 'boolean' },
                { name: 'productType', type: 'USER-DEFINED' }, // Retail, Raw, etc.
                { name: 'printerStation', type: 'text' }
            ],
            ProductVariant: [
                { name: 'lastCost', type: 'double precision' },
                { name: 'averageCost', type: 'double precision' },
                { name: 'yieldFactor', type: 'double precision' }
            ]
        };

        let totalDiscrepancies = 0;

        for (const s of schemas) {
            console.log(`\nAuditing schema: ${s}`);

            for (const [table, columns] of Object.entries(expected)) {
                const colRes = await client.query(`
          SELECT column_name, data_type 
          FROM information_schema.columns 
          WHERE table_schema = '${s}' AND table_name = '${table}'
        `);

                const actualCols = colRes.rows.reduce((acc, r) => {
                    acc[r.column_name] = r.data_type;
                    return acc;
                }, {});

                for (const exp of columns) {
                    if (!actualCols[exp.name]) {
                        console.error(`  [!] MISSING column '${exp.name}' in ${s}.${table}`);
                        totalDiscrepancies++;
                    } else {
                        // Optional: check types
                        // console.log(`  [OK] ${exp.name} exists in ${s}.${table}`);
                    }
                }
            }
        }

        if (totalDiscrepancies === 0) {
            console.log('\n✅ AUDIT PASSED: No missing columns found across all tenants.');
        } else {
            console.log(`\n❌ AUDIT FAILED: Found ${totalDiscrepancies} discrepancies.`);
        }

    } catch (err) {
        console.error('Audit failed with error:', err);
    } finally {
        await client.end();
    }
}

audit();
