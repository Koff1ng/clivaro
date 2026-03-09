import { PrismaClient } from '@prisma/client'
import { withTenantTx } from '../lib/tenancy'

const prisma = new PrismaClient()

async function testReceipt() {
    const tenantId = 'cml5qyzi90004qihnrbt57g6l'; // cafe singular

    const result = await withTenantTx(tenantId, async (tx: any) => {
        // Find a purchase order
        const po = await tx.purchaseOrder.findFirst();
        console.log('Purchase Order:', po?.id);

        // Find a warehouse
        const wh = await tx.warehouse.findFirst();
        console.log('Warehouse:', wh?.id);

        return { po, wh };
    });

    console.log(result);
}

testReceipt().catch(console.error).finally(() => prisma.$disconnect());
