import { prisma as masterPrisma } from './lib/db'
import { getTenantPrisma } from './lib/tenant-db'

async function test() {
    const tenant = await masterPrisma.tenant.findFirst({
        where: { active: true },
        select: { databaseUrl: true, name: true }
    })

    if (!tenant) {
        console.log('No active tenants found')
        return
    }

    console.log(`Testing tenant: ${tenant.name}`)
    const prisma = getTenantPrisma(tenant.databaseUrl)

    try {
        const count = await (prisma as any).electronicInvoiceTransmission.count()
        console.log(`Success! Transmission count: ${count}`)
    } catch (error: any) {
        console.error(`Error querying transmissions: ${error.message}`)
    } finally {
        await masterPrisma.$disconnect()
    }
}

test()
