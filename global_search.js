const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
    try {
        const tables = await prisma.$queryRawUnsafe(`
      SELECT table_schema, table_name 
      FROM information_schema.tables 
      WHERE table_name IN ('PaymentMethod', 'ShiftSummary', 'Payment')
      OR table_name ILIKE '%payment%'
      OR table_name ILIKE '%summary%'
    `);

        console.log('Global results:');
        tables.forEach(t => console.log(`  - ${t.table_schema}.${t.table_name}`));

    } catch (error) {
        console.error(error);
    } finally {
        await prisma.$disconnect();
    }
}

run();
