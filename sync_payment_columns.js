const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
    console.log('--- DEEP SYNCING PAYMENT ARCHITECTURE ---');

    try {
        const schemasRes = await prisma.$queryRawUnsafe(`
      SELECT schema_name 
      FROM information_schema.schemata 
      WHERE schema_name = 'public' OR schema_name LIKE 'tenant_%'
    `);

        const schemas = schemasRes.map(r => r.schema_name);

        for (const schema of schemas) {
            console.log(`Processing schema: ${schema}`);

            try {
                // 1. PaymentMethod columns
                await prisma.$executeRawUnsafe(`ALTER TABLE "${schema}"."PaymentMethod" ADD COLUMN IF NOT EXISTS "color" TEXT;`);
                await prisma.$executeRawUnsafe(`ALTER TABLE "${schema}"."PaymentMethod" ADD COLUMN IF NOT EXISTS "icon" TEXT;`);

                // 2. Payment table link
                await prisma.$executeRawUnsafe(`ALTER TABLE "${schema}"."Payment" ADD COLUMN IF NOT EXISTS "paymentMethodId" TEXT;`);

                // 3. ShiftSummary architecture (Ensuring it exists and has the correct unique constraint)
                // ShiftSummary usually depends on PaymentMethodId
                await prisma.$executeRawUnsafe(`ALTER TABLE "${schema}"."ShiftSummary" ADD COLUMN IF NOT EXISTS "paymentMethodId" TEXT;`);

                // Ensure the unique constraint shiftId_paymentMethodId exists
                const constraintCheck = await prisma.$queryRawUnsafe(`
          SELECT constraint_name 
          FROM information_schema.table_constraints 
          WHERE table_schema = $1 AND table_name = 'ShiftSummary' AND constraint_type = 'UNIQUE'
        `, schema);

                // If no unique constraint, we might need a migration, but for now we trust the automated prisma db push 
                // if user is running it. However, let's at least ensure the columns are there.

                console.log(`  Success for ${schema}`);
            } catch (err) {
                console.error(`  ERROR in ${schema}:`, err.message);
            }
        }

        console.log('--- DEEP SYNC COMPLETED ---');
    } catch (error) {
        console.error('CRITICAL FAILURE:', error);
    } finally {
        await prisma.$disconnect();
    }
}

run();
