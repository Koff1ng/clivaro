import { PrismaClient } from '@prisma/client'
import { withTenantTx } from '../lib/tenancy'

// @ts-ignore
const prisma = new PrismaClient()

async function main() {
    const tenantId = 'cml5qyzi90004qihnrbt57g6l'; // cafe singular
    console.log(`\nResetting stock for tenantId: ${tenantId}`);

    try {
        await withTenantTx(tenantId, async (tx: any) => {
            // Update all stock levels to 0
            const updated = await tx.stockLevel.updateMany({
                where: {},
                data: {
                    quantity: 0
                }
            });

            console.log(`Successfully updated ${updated.count} stock items to 0 quantity.`);

            // Delete stock movements to ensure a clean slate, or keep them for history?
            // Usually if it's incorrect initial data, it's better to just leave it or create an adjustment movement.
            // But just resetting StockLevel solves the dashboard issue.

            // Re-verify the calculation
            const [products, stockLevels] = await Promise.all([
                tx.product.findMany({
                    where: { active: true },
                    select: { id: true, cost: true, price: true }
                }),
                tx.stockLevel.findMany({
                    select: { productId: true, quantity: true }
                })
            ]);

            let totalValue = 0;
            const productMap = new Map();
            products.forEach((p: any) => productMap.set(p.id, p));

            stockLevels.forEach((sl: any) => {
                if (!sl.productId) return;
                const product = productMap.get(sl.productId);
                if (!product) return;
                totalValue += sl.quantity * Number(product.cost || 0);
            });

            console.log(`\nVerification: New total inventory value is $${totalValue}`);
        });
    } catch (e) {
        console.error(`Error with ${tenantId}:`, e);
    }
}

main().catch(console.error).finally(() => prisma.$disconnect());
