
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
    const username = 'julieth'
    console.log(`Fixing user (RAW SQL): ${username}`)

    try {
        // 1. Find user RAW - Fetch ALL specific columns to map
        const allUsers = await prisma.$queryRaw`SELECT id, username, "isSuperAdmin" FROM "public"."User"`

        const user = allUsers.find(u => u.username && u.username.trim().toLowerCase() === 'julieth')

        if (!user) {
            console.error('User not found in list (JS Check)! Valid hostnames:', allUsers.map(u => u.username))
            return
        }
        console.log('Found user (JS match):', user.id, 'isSuperAdmin:', user.isSuperAdmin)

        // 2. Find Admin Role RAW
        // We look for a role that contains 'admin' in the name
        const roles = await prisma.$queryRaw`SELECT * FROM "public"."Role"`
        // Helper to find case insensitive
        const adminRole = roles.find(r => r.name.toLowerCase().includes('admin') && !r.name.toLowerCase().includes('super'))

        if (!adminRole) {
            console.error('Admin role not found! Available roles:', roles.map(r => r.name))
            return
        }
        console.log('Found Admin Role:', adminRole.name, adminRole.id)

        // 3. Update User RAW
        await prisma.$executeRaw`UPDATE "public"."User" SET "isSuperAdmin" = false WHERE id = ${user.id}`
        console.log('Updated isSuperAdmin to false.')

        // 4. Assign Role RAW
        const existing = await prisma.$queryRaw`SELECT * FROM "public"."UserRole" WHERE "userId" = ${user.id} AND "roleId" = ${adminRole.id}`

        if (existing.length === 0) {
            // Generate a random ID for the link
            const id = 're_' + Math.random().toString(36).substr(2, 9)

            await prisma.$executeRaw`INSERT INTO "public"."UserRole" (id, "userId", "roleId", "createdAt") VALUES (${id}, ${user.id}, ${adminRole.id}, NOW())`
            console.log(`Assigned role ${adminRole.name} to user.`)
        } else {
            console.log('User already has this role.')
        }

    } catch (e) {
        console.error('Error executing raw SQL:', e.message)
    }
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect())
