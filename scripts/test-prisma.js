const { PrismaClient } = require('@prisma/client');
const { getTenantPrisma } = require('./lib/tenant-db');

async function main() {
    const prisma = new PrismaClient();
    const tenant = await prisma.tenant.findUnique({ where: { slug: 'cafe-singular' } });
    if (!tenant) throw new Error("Tenant not found");

    const tenantPrisma = getTenantPrisma(tenant.databaseUrl);

    console.log("Running simulated GET /api/products query...");
    const products = await tenantPrisma.product.findMany({
        where: { active: true },
        take: 20,
        include: {
            _count: { select: { variants: true } },
            stockLevels: { select: { quantity: true, warehouseId: true } },
            recipe: {
                include: {
                    items: {
                        include: {
                            ingredient: {
                                select: {
                                    id: true,
                                    stockLevels: { select: { quantity: true, warehouseId: true } },
                                    unitOfMeasure: true
                                }
                            }
                        }
                    }
                }
            }
        }
    });

    console.log(`Query returned ${products.length} products`);
    if (products.length > 0) {
        console.log("Sample product:", products[0].name);
    }
}
main().catch(console.error);
