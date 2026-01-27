import { prisma } from '../lib/db'
import fs from 'fs'
import path from 'path'

const logFile = path.join(process.cwd(), 'debug_output.txt')

function log(message: string) {
    console.log(message)
    fs.appendFileSync(logFile, message + '\n')
}

async function debugLeadsMaster() {
    fs.writeFileSync(logFile, '--- START MASTER DB DEBUG ---\n')
    log('🔍 Starting debug leads fetch from MASTER DB...')

    try {
        // Attempt to fetch leads from master DB
        log('🔄 Attempting to fetch leads from prisma (Master DB)...')

        // Replicating the query from app/api/leads/route.ts
        const leads = await prisma.lead.findMany({
            take: 10,
            include: {
                assignedTo: {
                    select: {
                        id: true,
                        name: true,
                    },
                },
            },
            orderBy: { createdAt: 'desc' },
        })

        log(`✅ Successfully fetched ${leads.length} leads from MASTER DB`)

        if (leads.length > 0) {
            log('Sample lead: ' + JSON.stringify(leads[0], null, 2))
        } else {
            log('No leads found in master DB.')
        }

    } catch (error: any) {
        log('❌ Error fetching leads from MASTER DB:')
        log(String(error))
        if (error instanceof Error) {
            log(error.stack || '')
        }

        if (error.code) {
            log(`Error Code: ${error.code}`)
        }
        if (error.meta) {
            log('Meta: ' + JSON.stringify(error.meta))
        }
    } finally {
        await prisma.$disconnect()
        log('--- END MASTER DB DEBUG ---')
    }
}

debugLeadsMaster()
