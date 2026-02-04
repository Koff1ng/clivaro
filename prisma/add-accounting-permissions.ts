
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
    console.log('Adding accounting permissions...')

    const permissions = [
        { name: 'manage_accounting', description: 'Manage accounting (PUC, Journals, Reports)' },
    ]

    for (const perm of permissions) {
        const p = await prisma.permission.upsert({
            where: { name: perm.name },
            update: {},
            create: perm,
        })
        console.log(`Permission ${perm.name} upserted.`)

        // Assign to ADMIN
        const adminRole = await prisma.role.findUnique({ where: { name: 'ADMIN' } })
        if (adminRole) {
            await prisma.rolePermission.upsert({
                where: {
                    roleId_permissionId: {
                        roleId: adminRole.id,
                        permissionId: p.id,
                    },
                },
                update: {},
                create: {
                    roleId: adminRole.id,
                    permissionId: p.id,
                },
            })
            console.log(`Granted ${perm.name} to ADMIN`)
        }
    }

    console.log('Done.')
}

main()
    .catch((e) => {
        console.error(e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
