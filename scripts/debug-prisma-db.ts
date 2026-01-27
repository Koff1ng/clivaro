import { PrismaClient } from '@prisma/client'
import fs from 'fs'
import path from 'path'

const logFile = path.join(process.cwd(), 'debug_prisma_db.txt')

function log(message: string) {
    console.log(message)
    fs.appendFileSync(logFile, message + '\n')
}

async function debugPrismaDb() {
    fs.writeFileSync(logFile, '--- START PRISMA DB DEBUG ---\n')

    // Explicitly point to prisma/dev.db
    const dbPath = path.join(process.cwd(), 'prisma', 'dev.db')
    const databaseUrl = `file:${dbPath.replace(/\\/g, '/')}`

    log(`Target Database: ${databaseUrl}`)

    const prisma = new PrismaClient({
        datasources: {
            db: {
                url: databaseUrl
            }
        },
        log: ['query', 'error']
    })

    try {
        const tenants = await prisma.tenant.findMany()
        log(`Tenants found: ${tenants.length}`)
        tenants.forEach(t => log(`- ${t.name} (Active: ${t.active})`))

        const users = await prisma.user.findMany({ take: 5 })
        log(`Users found: ${users.length}`)
        users.forEach(u => log(`- ${u.username}`))

    } catch (error: any) {
        log('❌ Error:')
        log(String(error))
    } finally {
        await prisma.$disconnect()
        log('--- END DEBUG ---')
    }
}

debugPrismaDb()
