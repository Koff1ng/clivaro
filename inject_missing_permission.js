const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
    console.log('--- STARTING PERMISSION SYNC ---');

    try {
        const schemasRes = await prisma.$queryRawUnsafe(`
      SELECT schema_name 
      FROM information_schema.schemata 
      WHERE schema_name = 'public' OR schema_name LIKE 'tenant_%'
    `);

        const schemas = schemasRes.map(r => r.schema_name);
        const permName = 'manage_settings';
        const permDesc = 'Manage site settings and payment methods';

        for (const schema of schemas) {
            console.log(`Checking schema: ${schema}`);

            try {
                await prisma.$transaction(async (tx) => {
                    // 1. Establish context
                    await tx.$executeRawUnsafe(`SET LOCAL search_path TO "${schema}";`);

                    // 2. Insert permission if missing
                    // We'll try to find it first to avoid ID conflicts if it exists with a different ID
                    const existingPerm = await tx.$queryRawUnsafe(`SELECT id FROM "Permission" WHERE name = $1`, permName);

                    let pId;
                    if (existingPerm.length > 0) {
                        pId = existingPerm[0].id;
                        console.log(`  Permission exists (${pId})`);
                    } else {
                        pId = 'cl' + Math.random().toString(36).substring(2, 11); // Simple fallback ID
                        await tx.$executeRawUnsafe(
                            `INSERT INTO "Permission" (id, name, description) VALUES ($1, $2, $3)`,
                            pId, permName, permDesc
                        );
                        console.log(`  Created permission (${pId})`);
                    }

                    // 3. Find ADMIN role
                    const adminRole = await tx.$queryRawUnsafe(`SELECT id FROM "Role" WHERE name = 'ADMIN'`);

                    if (adminRole.length > 0) {
                        const rId = adminRole[0].id;
                        // 4. Assign permission
                        await tx.$executeRawUnsafe(
                            `INSERT INTO "RolePermission" (id, "roleId", "permissionId") 
               VALUES ($1, $2, $3)
               ON CONFLICT DO NOTHING`,
                            'rp_' + pId + '_' + rId.substring(0, 5), rId, pId
                        );
                        console.log(`  Assigned to ADMIN role`);
                    } else {
                        console.log(`  WARNING: No ADMIN role found in ${schema}`);
                    }
                });
            } catch (err) {
                console.error(`  ERROR in ${schema}:`, err.message);
            }
        }

        console.log('--- SYNC COMPLETED ---');
    } catch (error) {
        console.error('CRITICAL FAILURE:', error);
    } finally {
        await prisma.$disconnect();
    }
}

run();
