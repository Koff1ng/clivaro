import { PrismaClient } from '@prisma/client'
import { PrismaClient as TenantPrismaClient } from '@prisma/client'

const prisma = new PrismaClient({
    datasources: {
        db: { url: process.env.DATABASE_URL },
    },
})

async function main() {
    const tenant = await prisma.tenant.findUnique({
        where: { slug: 'cafe-singular' }
    })

    if (!tenant) throw new Error('Tenant not found')

    console.log(`Connecting to: ${tenant.databaseUrl}`)

    const tenantPrisma = new TenantPrismaClient({
        datasources: {
            db: { url: tenant.databaseUrl },
        },
    })

    // Check tables
    const tables = await tenantPrisma.$queryRawUnsafe(`
        SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'StockMovement'
    `);
    console.log('Tables:', tables);

    // Check columns
    const columns = await tenantPrisma.$queryRawUnsafe(`
        SELECT column_name, data_type FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'StockMovement'
    `);
    console.log('Columns:', columns);

    // Check WarehouseZone
    const cols2 = await tenantPrisma.$queryRawUnsafe(`
        SELECT column_name, data_type FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'WarehouseZone'
    `);
    console.log('WarehouseZone columns:', cols2);

    await tenantPrisma.$disconnect()
    await prisma.$disconnect()
}

main().catch(console.error)
