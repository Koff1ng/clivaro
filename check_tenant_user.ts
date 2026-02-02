
import { prisma } from './lib/db'
import { withTenantTx } from './lib/tenancy'

async function check() {
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

    try {
        await withTenantTx(tenant.id, async (tx) => {
            const users = await tx.user.findMany({
                select: { id: true, username: true, email: true, active: true }
            })
            console.log(`Users in tenant_${tenant.id}:`, users)

            if (users.length === 0) {
                console.warn('WARNING: No users found in this tenant schema!')
            }
        })
    } catch (e: any) {
        console.error('Error querying tenant schema:', e.message)
    }
}

check().catch(console.error).finally(() => prisma.$disconnect())
