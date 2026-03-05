import { loadEnvConfig } from '@next/env'
loadEnvConfig(process.cwd())
import { prisma } from './lib/db'
import fs from 'fs'

async function main() {
    const tenants = await prisma.tenant.findMany({ select: { id: true, slug: true, name: true, active: true } })
    fs.writeFileSync('all-tenants.json', JSON.stringify(tenants, null, 2))
    console.log('Saved to all-tenants.json')
}
main()
