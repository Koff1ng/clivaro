import { prisma as masterPrisma } from './lib/db'

async function checkMaster() {
    try {
        const count = await (masterPrisma as any).electronicInvoiceProviderConfig.count()
        console.log(`Master DB has electronicInvoiceProviderConfig. Count: ${count}`)
    } catch (error: any) {
        console.error(`Master DB Error: ${error.message}`)
    } finally {
        await masterPrisma.$disconnect()
    }
}

checkMaster()
