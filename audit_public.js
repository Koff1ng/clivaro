const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
    try {
        console.log('Auditing: public schema');

        const tables = await prisma.$queryRawUnsafe(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);

        console.log('Tables in public schema:');
        tables.forEach(t => console.log(`  - ${t.table_name}`));

    } catch (error) {
        console.error(error);
    } finally {
        await prisma.$disconnect();
    }
}

run();
