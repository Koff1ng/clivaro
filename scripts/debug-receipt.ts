import { PrismaClient } from '@prisma/client'

// @ts-ignore
const prisma = new PrismaClient()

async function main() {
    const tenantId = 'cml5qyzi90004qihnrbt57g6l'; // cafe singular

    // Check purchase orders
    const pos = await prisma.$queryRawUnsafe(`SELECT id, status, number FROM "cml5qyzi90004qihnrbt57g6l".\"PurchaseOrder\"`);
    console.log('Purchase Orders:', pos);

    // Check warehouses
    const warehouses = await prisma.$queryRawUnsafe(`SELECT id, name FROM "cml5qyzi90004qihnrbt57g6l".\"Warehouse\"`);
    console.log('Warehouses:', warehouses);
}

main().catch(console.error).finally(() => prisma.$disconnect());
