import { PrismaClient } from '@prisma/client'
import { PrismaClient as TenantPrismaClient } from '@prisma/client'

const prisma = new PrismaClient({
    datasources: { db: { url: process.env.DATABASE_URL } }
})

async function main() {
    const tenant = await prisma.tenant.findUnique({
        where: { slug: 'cafe-singular' }
    })

    if (!tenant) throw new Error('not found')

    const tenantUrl = tenant.databaseUrl

    const tPrisma = new TenantPrismaClient({
        datasources: { db: { url: tenantUrl } }
    })

    const res1 = await tPrisma.$queryRawUnsafe(`SELECT current_schema() as schema`)
    console.log('Current schema:', res1)

    const res2 = await tPrisma.$queryRawUnsafe(`
        SELECT table_schema, table_name 
        FROM information_schema.tables 
        WHERE table_schema = current_schema() AND table_name = 'WarehouseZone'
    `)
    console.log('WarehouseZone check:', res2)

    const res3 = await tPrisma.$queryRawUnsafe(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_schema = current_schema() AND table_name = 'StockMovement'
    `)
    console.log('StockMovement columns:', res3)

    await tPrisma.$disconnect()
    await prisma.$disconnect()
}

main().catch(console.error)
