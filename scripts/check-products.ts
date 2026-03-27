
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
    console.log('🔍 Checking products across tenants...')
    const tenants = await prisma.tenant.findMany({ where: { active: true } })
    
    for (const tenant of tenants) {
        const schemaName = `tenant_${tenant.id.replace(/-/g, '')}`
        console.log(`\n📦 Tenant: ${tenant.name} (${schemaName})`)
        try {
            const result: any[] = await prisma.$queryRawUnsafe(`SELECT count(*) as count FROM "${schemaName}"."Product"`)
            console.log(`   ✅ Products found: ${result[0].count}`)
        } catch (error: any) {
            console.error(`   ❌ Error: ${error.message}`)
        }
    }
}

main()
    .then(async () => {
        await prisma.$disconnect()
    })
    .catch(async (e) => {
        console.error(e)
        await prisma.$disconnect()
        process.exit(1)
    })
