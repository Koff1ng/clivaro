
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
    const hashedPassword = await bcrypt.hash('Admin123!', 10)

    const user = await prisma.user.upsert({
        where: { username: 'admin' },
        update: {
            password: hashedPassword,
            isSuperAdmin: true,
            active: true,
            name: 'Super Admin',
        },
        create: {
            username: 'admin',
            email: 'admin@clivaro.com',
            password: hashedPassword,
            name: 'Super Admin',
            isSuperAdmin: true,
            active: true,
        },
    })

    console.log('Super Admin user created/updated:', user)
}

main()
    .catch((e) => {
        console.error(e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
