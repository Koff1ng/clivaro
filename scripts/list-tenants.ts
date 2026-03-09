
import { PrismaClient } from '@prisma/client'

async function main() {
    const prisma = new PrismaClient()
    const tenants = await prisma.tenant.findMany()
    console.log(JSON.stringify(tenants, null, 2))
    await prisma.$disconnect()
}

main()
