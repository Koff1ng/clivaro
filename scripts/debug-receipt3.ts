import { PrismaClient } from '@prisma/client'
import { withTenantTx } from '../lib/tenancy'
import { toDecimal } from '../lib/numbers'
import { updateProductCost } from '../lib/inventory'

const prisma = new PrismaClient()

async function testCreateReceipt() {
    const tenantId = 'cml5qyzi90004qihnrbt57g6l'; // cafe singular

    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } })
    console.log('Got DB URL:', tenant?.databaseUrl);

    const poId = 'cmkykxst2001l6l20y9s26gmk'
    const whId = 'cmkykj4cr002ckowymgjqihct'

    const result = await withTenantTx(tenantId, async (tx: any) => {
        const product = await tx.product.findFirst();

        const data = {
            purchaseOrderId: poId,
            warehouseId: whId, // Using the correct warehouseId
            notes: 'Test',
            items: [{
                productId: product.id,
                variantId: null,
                quantity: 5,
                unitCost: 10,
                purchaseOrderItemId: null
            }]
        };

        const receiptCount = await tx.goodsReceipt.count()
        const receiptNumber = `GR-${String(receiptCount + 1).padStart(6, '0')}`

        const receipt = await tx.goodsReceipt.create({
            data: {
                number: receiptNumber,
                purchaseOrderId: data.purchaseOrderId,
                warehouseId: data.warehouseId, // This might not be valid if the warehouse isn't found
                notes: data.notes || null,
                createdById: 'cmkykj46n0029kowy1w49yy8e',
                items: {
                    create: data.items.map((item: any) => ({
                        productId: item.productId,
                        variantId: item.variantId || null,
                        quantity: toDecimal(item.quantity),
                        unitCost: toDecimal(item.unitCost),
                        purchaseOrderItemId: item.purchaseOrderItemId || null,
                    })),
                },
            },
        })

        for (const item of data.items) {
            const quantity = toDecimal(item.quantity)
            const unitCost = toDecimal(item.unitCost)

            await tx.stockMovement.create({
                data: {
                    warehouseId: data.warehouseId,
                    productId: item.productId,
                    variantId: item.variantId || null,
                    type: 'IN',
                    quantity: quantity,
                    reason: `Recepción de compra - ${receiptNumber}`,
                    createdById: 'cmkykj46n0029kowy1w49yy8e',
                    reference: receiptNumber,
                },
            })

            const whereClause: any = {
                warehouseId: data.warehouseId,
                productId: item.productId,
                variantId: item.variantId || null,
            }

            const existingStock = await tx.stockLevel.findFirst({
                where: whereClause,
            })

            if (existingStock) {
                const newQuantity = existingStock.quantity + quantity
                await tx.stockLevel.update({
                    where: { id: existingStock.id },
                    data: { quantity: newQuantity },
                })
            } else {
                await tx.stockLevel.create({
                    data: {
                        warehouseId: data.warehouseId,
                        productId: item.productId,
                        variantId: item.variantId || null,
                        quantity: quantity,
                        minStock: 0,
                    },
                })
            }

            await updateProductCost(
                item.productId,
                data.warehouseId,
                quantity,
                unitCost,
                tx
            )
        }

        throw new Error('ROLLBACK OKE');
    });
}

testCreateReceipt().catch(console.error).finally(() => prisma.$disconnect());
