import { loadEnvConfig } from '@next/env'
loadEnvConfig(process.cwd())
import { prisma } from './lib/db'

async function main() {
    try {
        const tenant = await prisma.tenant.findUnique({
            where: { slug: 'cafe-singular' },
            include: { plan: true }
        })
        console.log(JSON.stringify(tenant, null, 2))
    } catch (err) {
        console.error('Error fetching tenant:', err)
    }
}
main()
