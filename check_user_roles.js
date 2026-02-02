
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
    const username = 'julieth'
    console.log(`Checking roles for user: ${username}`)

    try {
        // Check User Table details - LIst first 10
        const user = await prisma.$queryRaw`SELECT id, username, "isSuperAdmin", active FROM "public"."User" LIMIT 10`
        console.log('All Users:', user)

        if (user.length > 0) {
            // Find julieth
            const targetUser = user.find(u => u.username === 'julieth' || u.username === 'Julieth')
            if (targetUser) {
                const userId = targetUser.id

                // Check Roles
                const roles = await prisma.$queryRaw`
        SELECT r.name as role_name, p.name as permission_name 
        FROM "public"."UserRole" ur
        JOIN "public"."Role" r ON ur."roleId" = r.id
        JOIN "public"."RolePermission" rp ON r.id = rp."roleId"
        JOIN "public"."Permission" p ON rp."permissionId" = p.id
        WHERE ur."userId" = ${userId}
      `
                console.log('Assigned Roles & Permissions:', roles)
            }
        }
    } catch (e) {
        console.error('Error querying:', e.message)
    }
}

main()
    .finally(() => prisma.$disconnect())
