const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const COLOMBIAN_RETENTIONS = [
    { id: 'rete_fte_25', name: 'ReteFuente (2.5%) - Compras', type: 'RETEFUENTE', rate: 2.5 },
    { id: 'rete_fte_35', name: 'ReteFuente (3.5%) - Compras', type: 'RETEFUENTE', rate: 3.5 },
    { id: 'rete_fte_40', name: 'ReteFuente (4.0%) - Servicios', type: 'RETEFUENTE', rate: 4.0 },
    { id: 'rete_fte_110', name: 'ReteFuente (11%) - Honorarios', type: 'RETEFUENTE', rate: 11.0 },
    { id: 'rete_ica_bog', name: 'ReteICA (1.104%) - Bogotá', type: 'RETEICA', rate: 1.104 },
];

async function run() {
    console.log('--- SEEDING COLOMBIAN RETENTIONS ---');

    try {
        const schemasRes = await prisma.$queryRawUnsafe(`
      SELECT schema_name 
      FROM information_schema.schemata 
      WHERE schema_name = 'public' OR schema_name LIKE 'tenant_%'
    `);

        const schemas = schemasRes.map(r => r.schema_name);

        for (const schema of schemas) {
            console.log(`Processing schema: ${schema}`);

            for (const tax of COLOMBIAN_RETENTIONS) {
                try {
                    // Upsert logic
                    await prisma.$executeRawUnsafe(`
            INSERT INTO "${schema}"."TaxRate" (id, name, type, rate, "updatedAt")
            VALUES ('${tax.id}', '${tax.name}', '${tax.type}', ${tax.rate}, NOW())
            ON CONFLICT (id) DO UPDATE SET 
              name = '${tax.name}', 
              type = '${tax.type}', 
              rate = ${tax.rate}, 
              "updatedAt" = NOW();
          `);
                    console.log(`  - Upserted ${tax.name}`);
                } catch (err) {
                    console.error(`  - Failed to upsert ${tax.name}: ${err.message}`);
                }
            }
        }

        console.log('--- COMPLETED ---');
    } catch (error) {
        console.error('CRITICAL FAILURE:', error);
    } finally {
        await prisma.$disconnect();
    }
}

run();
