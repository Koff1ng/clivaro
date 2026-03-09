import { PrismaClient } from '@prisma/client'
import { PrismaClient as TenantPrismaClient } from '@prisma/client'

const prisma = new PrismaClient({
    datasources: { db: { url: process.env.DATABASE_URL } }
})

async function main() {
    const tenant = await prisma.tenant.findUnique({
        where: { slug: 'cafe-singular' }
    })

    console.log('ENV DATABASE_URL:', process.env.DATABASE_URL)
    console.log('TENANT URL IN DB:', tenant?.databaseUrl)

    // Connect using ENV DATABASE_URL but for the tenant schema
    const envUrlObj = new URL(process.env.DATABASE_URL!)
    envUrlObj.searchParams.set('schema', `tenant_${tenant?.id}`)
    envUrlObj.searchParams.set('pgbouncer', 'true')

    const tPrismaEnv = new TenantPrismaClient({ datasources: { db: { url: envUrlObj.toString() } } })

    const resEnv = await tPrismaEnv.$queryRawUnsafe(`
        SELECT column_name FROM information_schema.columns 
        WHERE table_schema = current_schema() AND table_name = 'StockMovement'
    `)
    console.log('StockMovement via ENV URL:', resEnv.find((c: any) => c.column_name === 'zoneId'))

    // Connect using TENANT URL
    const tPrismaDb = new TenantPrismaClient({ datasources: { db: { url: tenant!.databaseUrl } } })
    const resDb = await tPrismaDb.$queryRawUnsafe(`
        SELECT column_name FROM information_schema.columns 
        WHERE table_schema = current_schema() AND table_name = 'StockMovement'
    `)
    console.log('StockMovement via TENANT URL:', resDb.find((c: any) => c.column_name === 'zoneId'))

    await tPrismaEnv.$disconnect()
    await tPrismaDb.$disconnect()
    await prisma.$disconnect()
}

main().catch(console.error)
