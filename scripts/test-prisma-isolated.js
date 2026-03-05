const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');

// Copying getTenantPrisma logic to run isolated
const CAFE_URL = 'postgresql://postgres:cartuchera123@db.kkylpwgoxymskhblorsz.supabase.co:5432/postgres?schema=tenant_cml5qyzi90004qihnrbt57g6l';

async function main() {
    const tPrisma = new PrismaClient({ datasources: { db: { url: CAFE_URL } } });

    console.log("Running GET /api/products query via Prisma...");
    try {
        const products = await tPrisma.product.findMany({
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
    } catch (e) {
        console.error("Prisma query failed:", e);
    } finally {
        await tPrisma.$disconnect();
    }
}
main().catch(console.error);
