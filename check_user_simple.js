
const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function main() {
    const slug = 'la-comitiva'
    console.log(`Checking tenant: ${slug}`)

    const tenant = await prisma.tenant.findUnique({
        where: { slug }
    })

    if (!tenant) {
        console.error('Tenant not found!')
        return
    }

    console.log('Tenant found:', tenant.id, 'Active:', tenant.active)

    const schemaName = `tenant_${tenant.id}`
    console.log(`Querying schema: ${schemaName}`)

    try {
        // Use raw query to bypass any client model logic and just check the table
        const users = await prisma.$queryRawUnsafe(`SELECT id, username, email, active, password FROM "${schemaName}"."User"`)
        console.log('Users found in tenant schema:', users)
    } catch (e) {
        console.error('Error querying tenant schema:', e.message)
    }

    try {
        const publicUsers = await prisma.$queryRaw`SELECT id, username, email, "tenantId", active FROM "public"."User" LIMIT 5`
        console.log('Users found in PUBLIC schema:', publicUsers)
    } catch (e) {
        console.error('Error querying public schema:', e.message)
    }
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect())
