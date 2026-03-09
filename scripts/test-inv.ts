import { PrismaClient } from '@prisma/client'
import { withTenantTx } from '../lib/tenancy'

// @ts-ignore
const prisma = new PrismaClient()

async function main() {
    const schemas: any = await prisma.$queryRawUnsafe(`SELECT schema_name FROM information_schema.schemata WHERE schema_name LIKE 'tenant_%'`);
    console.log('Schemas:', schemas.map((s: any) => s.schema_name));

    if (schemas.length === 0) {
        console.log("No schemas found.");
        return;
    }

    for (const schema of schemas) {
        const schemaName = schema.schema_name;
        if (!schemaName.startsWith('tenant_')) continue;
        const tenantId = schemaName.replace('tenant_', '');
        console.log(`\nChecking tenantId: ${tenantId}`);

        try {
            await withTenantTx(tenantId, async (tx: any) => {
                const [products, stockLevels] = await Promise.all([
                    tx.product.findMany({
                        where: { active: true },
                        select: { id: true, name: true, cost: true, price: true, trackStock: true, active: true }
                    }),
                    tx.stockLevel.findMany({
                        select: { productId: true, quantity: true }
                    })
                ]);

                console.log(`  Found ${products.length} active products and ${stockLevels.length} stock levels`);

                let totalValue = 0;
                let totalMarketValue = 0;
                let totalItems = 0;

                const productsWithStock: any[] = [];
                const productMap = new Map();
                products.forEach((p: any) => productMap.set(p.id, p));

                stockLevels.forEach((sl: any) => {
                    if (!sl.productId) return;
                    const product = productMap.get(sl.productId);
                    if (!product) return; // skip if inactive or not found

                    const stock = Number(sl.quantity || 0);
                    if (stock !== 0) {
                        productsWithStock.push({ name: product.name, quantity: stock, cost: product.cost, totalValue: stock * (product.cost || 0) });
                    }

                    totalValue += stock * Number(product.cost || 0);
                    totalMarketValue += stock * Number(product.price || 0);
                    totalItems += stock;
                });

                console.log(`  Calc: totalValue=${totalValue}, totalMarketValue=${totalMarketValue}, totalItems=${totalItems}`);
                if (productsWithStock.length > 0) {
                    console.log('  Top items contributing to value:');
                    console.log(productsWithStock.sort((a, b) => b.totalValue - a.totalValue).slice(0, 5));
                }
            });
        } catch (e) {
            console.error(`Error with ${tenantId}:`, e);
        }
    }
}
main().catch(console.error).finally(() => prisma.$disconnect());
