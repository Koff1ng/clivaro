const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
    console.log('--- TAX RATE AUDIT ---');

    try {
        const schemasRes = await prisma.$queryRawUnsafe(`
      SELECT schema_name 
      FROM information_schema.schemata 
      WHERE schema_name LIKE 'tenant_%'
      LIMIT 1
    `);

        if (schemasRes.length === 0) return;
        const schema = schemasRes[0].schema_name;
        console.log(`Auditing schema: ${schema}`);

        // Check if table exists
        const tableCheck = await prisma.$queryRawUnsafe(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = $1 AND table_name = 'TaxRate'
    `, schema);

        if (tableCheck.length === 0) {
            console.log('TaxRate table DOES NOT EXIST in this schema.');
            return;
        }

        // List records
        const rates = await prisma.$queryRawUnsafe(`SELECT * FROM "${schema}"."TaxRate"`);
        console.log(`Found ${rates.length} tax rates:`);
        rates.forEach(r => {
            console.log(`  - ID: ${r.id}, Name: ${r.name}, Rate: ${r.rate}`);
        });

    } catch (error) {
        console.error('Audit failed:', error);
    } finally {
        await prisma.$disconnect();
    }
}

run();
