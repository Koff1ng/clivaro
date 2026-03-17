const { Client } = require('pg');

const url = 'postgresql://postgres:cartuchera123@db.kkylpwgoxymskhblorsz.supabase.co:5432/postgres';

async function audit() {
  console.log('--- Starting COMPREHENSIVE DB Audit ---');
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

    // 2. Define expected tables and their columns (focus on Inventory right now)
    const expected = {
      Product: [
        { name: 'lastCost', type: 'double precision' },
        { name: 'averageCost', type: 'double precision' },
        { name: 'percentageMerma', type: 'double precision' },
        { name: 'stockAlertEnabled', type: 'boolean' }
      ],
      ProductVariant: [
        { name: 'lastCost', type: 'double precision' },
        { name: 'averageCost', type: 'double precision' },
        { name: 'yieldFactor', type: 'double precision' }
      ],
      StockLevel: [
        { name: 'id', type: 'text' },
        { name: 'warehouseId', type: 'text' },
        { name: 'zoneId', type: 'text' },
        { name: 'productId', type: 'text' },
        { name: 'variantId', type: 'text' },
        { name: 'quantity', type: 'double precision' }
      ],
      StockMovement: [
        { name: 'id', type: 'text' },
        { name: 'warehouseId', type: 'text' },
        { name: 'type', type: 'text' },
        { name: 'quantity', type: 'double precision' }
      ],
      PhysicalInventory: [
        { name: 'id', type: 'text' },
        { name: 'number', type: 'text' },
        { name: 'status', type: 'text' }
      ],
      PhysicalInventoryItem: [
        { name: 'id', type: 'text' },
        { name: 'physicalInventoryId', type: 'text' },
        { name: 'productId', type: 'text' },
        { name: 'systemQuantity', type: 'double precision' }
      ]
    };

    let totalDiscrepancies = 0;

    for (const s of schemas) {
      console.log(`\nAuditing schema: ${s}`);
      
      const tablesInSchemaRes = await client.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = '${s}'
      `);
      const tablesInSchema = tablesInSchemaRes.rows.map(r => r.table_name);

      for (const [table, columns] of Object.entries(expected)) {
        if (!tablesInSchema.includes(table)) {
          console.error(`  [!] MISSING TABLE: ${s}.${table}`);
          totalDiscrepancies++;
          continue;
        }

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
          }
        }
      }
    }

    if (totalDiscrepancies === 0) {
      console.log('\n✅ AUDIT PASSED: All tables and columns exist across all tenants.');
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
