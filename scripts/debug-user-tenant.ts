import fs from 'fs'
import path from 'path'

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

import { prisma } from '../lib/db'

const logFile = path.join(process.cwd(), 'debug_user_tenant.txt')

function log(message: string) {
    console.log(message)
    fs.appendFileSync(logFile, message + '\n')
}

async function debugUsersTenants() {
    fs.writeFileSync(logFile, '--- START USER/TENANT DEBUG ---\n')
    log(`CWD: ${process.cwd()}`)
    log(`DATABASE_URL: ${process.env.DATABASE_URL}`)

    try {
        const tenants = await prisma.tenant.findMany()
        log(`Tenants found: ${tenants.length}`)
        tenants.forEach(t => log(`- ${t.name} (Active: ${t.active}) DB: ${t.databaseUrl}`))

        const users = await prisma.user.findMany({
            take: 10,
            include: {
                userRoles: {
                    include: { role: true }
                }
            }
        })
        log(`Users found: ${users.length}`)
        users.forEach(u => {
            const roles = u.userRoles.map(ur => ur.role.name).join(', ')
            log(`- ${u.username} SuperAdmin: ${u.isSuperAdmin} Roles: ${roles}`)
        })

    } catch (error: any) {
        log('❌ Error:')
        log(String(error))
    } finally {
        await prisma.$disconnect()
        log('--- END DEBUG ---')
    }
}

debugUsersTenants()
