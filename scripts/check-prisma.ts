// Script to fetch /api/products internally simulating a logged in request
import fetch from 'node-fetch';
import { loadEnvConfig } from '@next/env';
import { PrismaClient } from '@prisma/client';

loadEnvConfig(process.cwd());

async function main() {
    const prisma = new PrismaClient();
    // Get cafe-singular admin user session token structure
    const user = await prisma.user.findFirst({
        where: { username: 'julieth' },
        include: { tenant: true }
    });

    if (!user) {
        console.log("No user julieth found");
        return;
    }

    console.log(`User found: ${user.id}, tenant: ${user.tenantId}`);

    // We can't easily mock next-auth getServerSession here, so instead let's just use Prisma 
    // with withTenantTx exactly as the API does.

    const { withTenantTx } = require('./lib/tenancy');

    try {
        const products = await withTenantTx(user.tenantId, async (tx) => {
            return await tx.product.findMany({
                where: { active: true },
                take: 10,
                include: {
                    stockLevels: { select: { quantity: true, warehouseId: true } },
                }
            });
        });

        console.log(`withTenantTx returned ${products.length} products`);
        if (products.length > 0) {
            console.log(products[0]);
        } else {
            console.log("No products returned by Prisma!");

            // Let's do a raw query inside the tx
            const rawCount = await withTenantTx(user.tenantId, async (tx) => {
                const res = await tx.$queryRaw`SELECT COUNT(*) as count FROM "Product"`;
                return res[0].count;
            });
            console.log(`Raw count in tx: ${rawCount}`);
        }
    } catch (e) {
        console.error("Error in withTenantTx:", e);
    }

    await prisma.$disconnect();
}

main().catch(console.error);
