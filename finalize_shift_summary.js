const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
    console.log('--- FINALIZING SHIFTSUMMARY ARCHITECTURE ---');

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
                // 1. Ensure columns exist (belt and suspenders)
                await prisma.$executeRawUnsafe(`ALTER TABLE "${schema}"."ShiftSummary" ADD COLUMN IF NOT EXISTS "paymentMethodId" TEXT;`);

                // 2. Add unique constraint shiftId_paymentMethodId if missing
                // In Postgres, this is usually an index
                await prisma.$executeRawUnsafe(`
          DO $$ 
          BEGIN 
            IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ShiftSummary_shiftId_paymentMethodId_key' AND connamespace = (SELECT oid FROM pg_namespace WHERE nspname = '${schema}')) THEN
              ALTER TABLE "${schema}"."ShiftSummary" ADD CONSTRAINT "ShiftSummary_shiftId_paymentMethodId_key" UNIQUE ("shiftId", "paymentMethodId");
            END IF;
          END $$;
        `);

                // 3. Ensure CASH and ELECTRONIC methods exist and have correct types
                // This prevents 500 errors if a legacy fallback is triggered
                const methods = ['CASH', 'ELECTRONIC', 'CARD', 'TRANSFER'];
                for (const m of methods) {
                    await prisma.$executeRawUnsafe(`
             INSERT INTO "${schema}"."PaymentMethod" (id, name, type, active)
             VALUES ('cl_default_' || LOWER($1), $1, $2, true)
             ON CONFLICT (name) DO NOTHING
           `, m, m === 'CASH' ? 'CASH' : 'ELECTRONIC');
                }

                console.log(`  Architecture finalized for ${schema}`);
            } catch (err) {
                console.error(`  ERROR in ${schema}:`, err.message);
            }
        }

        console.log('--- ARCHITECTURE FINALIZED ---');
    } catch (error) {
        console.error('CRITICAL FAILURE:', error);
    } finally {
        await prisma.$disconnect();
    }
}

run();
