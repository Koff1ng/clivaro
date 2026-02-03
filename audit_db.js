const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
    try {
        const schemasRes = await prisma.$queryRawUnsafe(`
      SELECT schema_name 
      FROM information_schema.schemata 
      WHERE schema_name LIKE 'tenant_%'
      LIMIT 1
    `);

        if (schemasRes.length === 0) return;
        const schema = schemasRes[0].schema_name;
        console.log(`Auditing: ${schema}`);

        const targetTables = ['PaymentMethod', 'Payment', 'ShiftSummary', 'InvoiceLineTax'];

        for (const table of targetTables) {
            console.log(`\nTable: ${table}`);
            const info = await prisma.$queryRawUnsafe(`
        SELECT column_name, data_type
        FROM information_schema.columns 
        WHERE table_schema = $1 AND table_name = $2
        ORDER BY column_name
      `, schema, table);

            if (info.length === 0) {
                console.log('  NOT FOUND (Case sensitive check...)');
                // Try exact name as in DB if it's different
            } else {
                info.forEach(c => console.log(`  - ${c.column_name}: ${c.data_type}`));
            }
        }

        // List all tables just in case
        console.log('\nAll tables in schema:');
        const allTables = await prisma.$queryRawUnsafe(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = $1
    `, schema);
        allTables.forEach(t => console.log(`  - ${t.table_name}`));

    } catch (error) {
        console.error(error);
    } finally {
        await prisma.$disconnect();
    }
}

run();
