import { PrismaClient } from '@prisma/client'
import fs from 'fs'
import path from 'path'

const logFile = path.join(process.cwd(), 'debug_verify.txt')

function log(message: string) {
    console.log(message)
    fs.appendFileSync(logFile, message + '\n')
}

async function verifyLeads() {
    fs.writeFileSync(logFile, '--- START VERIFICATION ---\n')

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
    })

    try {
        const leads = await prisma.lead.findMany({ take: 5 })
        log(`Leads found: ${leads.length}`)
        if (leads.length > 0) {
            leads.forEach(l => log(`- Lead: ${l.name} (Status: ${l.stage})`))
        } else {
            log('No leads found! Seeding failed?')
        }

    } catch (error: any) {
        log('❌ Error:')
        log(String(error))
    } finally {
        await prisma.$disconnect()
        log('--- END VERIFICATION ---')
    }
}

verifyLeads()
