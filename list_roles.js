
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
    const roles = await prisma.role.findMany({
        select: { id: true, name: true }
    })
    console.log('Available Roles:', roles)
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect())
