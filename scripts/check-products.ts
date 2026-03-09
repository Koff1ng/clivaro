import { PrismaClient } from '@prisma/client'
import { withTenantTx } from '../lib/tenancy'

// @ts-ignore
const prisma = new PrismaClient()

async function main() {
    const tenantId = 'cml5qyzi90004qihnrbt57g6l'; // cafe singular

    try {
        await withTenantTx(tenantId, async (tx: any) => {
            const products = await tx.product.findMany({
                where: { active: true },
                select: { id: true, name: true, trackStock: true, enableRecipeConsumption: true, productType: true }
            });
            console.log("Products:", products);
        });
    } catch (e) {
        console.error(`Error with ${tenantId}:`, e);
    }
}

main().catch(console.error).finally(() => prisma.$disconnect());
