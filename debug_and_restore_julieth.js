const fs = require('fs')
const path = require('path')

// Manually parse .env
const envPath = path.join(process.cwd(), '.env')
if (fs.existsSync(envPath)) {
    const envConfig = fs.readFileSync(envPath, 'utf-8')
    envConfig.split('\n').forEach(line => {
        const match = line.match(/^([^=]+)=(.*)$/)
        if (match) {
            const key = match[1].trim()
            const value = match[2].trim().replace(/^["'](.*)["']$/, '$1')
            process.env[key] = value
        }
    })
}

const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

const bcrypt = require('bcryptjs')

async function main() {
    console.log('--- START RESTORE JULIETH ---')
    console.log('DB URL:', process.env.DATABASE_URL)

    try {
        // 1. Find User (Case Insensitive)
        const users = await prisma.$queryRaw`SELECT * FROM "public"."User" WHERE LOWER(username) = 'julieth'`

        let user
        if (users.length === 0) {
            console.log('⚠️ User julieth NOT FOUND. Creating new user...')
            // Create User
            const passwordHash = await bcrypt.hash('admin123', 10)
            const newId = 'ju_' + Math.random().toString(36).substr(2, 9)

            await prisma.$executeRaw`
                INSERT INTO "public"."User" (id, username, email, password, name, "isSuperAdmin", active, "createdAt", "updatedAt")
                VALUES (${newId}, 'julieth', 'julieth@comitiva.local', ${passwordHash}, 'Julieth', false, true, NOW(), NOW())
            `
            console.log('✅ User julieth CREATED.')

            // Fetch again
            const fresh = await prisma.$queryRaw`SELECT * FROM "public"."User" WHERE username = 'julieth'`
            user = fresh[0]
        } else {
            user = users[0]
            console.log(`✅ Found User: ${user.username} (ID: ${user.id})`)
        }

        console.log(`   Current isSuperAdmin: ${user.isSuperAdmin}`)

        // 2. Fix SuperAdmin Status
        if (user.isSuperAdmin) {
            console.log('   User IS SuperAdmin. Disabling...')
            await prisma.$executeRaw`UPDATE "public"."User" SET "isSuperAdmin" = false WHERE id = ${user.id}`
            console.log('   ✅ isSuperAdmin set to FALSE.')
        } else {
            console.log('   User is ALREADY NOT SuperAdmin.')
        }

        // 3. Find ADMIN Role
        const roles = await prisma.$queryRaw`SELECT * FROM "public"."Role" WHERE name = 'ADMIN'`
        if (roles.length === 0) {
            console.error('❌ ADMIN Role NOT FOUND.')
            return
        }
        const adminRole = roles[0]
        console.log(`✅ Found Role: ${adminRole.name} (ID: ${adminRole.id})`)

        // 4. Assign Role if missing
        const userRoles = await prisma.$queryRaw`SELECT * FROM "public"."UserRole" WHERE "userId" = ${user.id} AND "roleId" = ${adminRole.id}`

        if (userRoles.length === 0) {
            console.log('   User missing ADMIN role. Assigning...')
            const newId = 'ur_' + Math.random().toString(36).substr(2, 9)
            await prisma.$executeRaw`
            INSERT INTO "public"."UserRole" (id, "userId", "roleId", "createdAt") 
            VALUES (${newId}, ${user.id}, ${adminRole.id}, NOW())
        `
            console.log('   ✅ Assigned ADMIN role.')
        } else {
            console.log('   User ALREADY has ADMIN role.')
        }

        // 5. Verify Tenant Link (Optional check)
        // Legacy tenants use public schema, so no explicit link needed in UserTenant table usually,
        // unless the app uses explicit UserTenant binding.
        console.log('--- RESTORE COMPLETE ---')

    } catch (e) {
        console.error('❌ Error:', e)
    }
}

main()
    .finally(() => prisma.$disconnect())
