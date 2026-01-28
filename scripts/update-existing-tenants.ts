
import { PrismaClient } from '@prisma/client'
import { Client } from 'pg'
import * as fs from 'fs'
import * as path from 'path'
import { loadEnvConfig } from '@next/env'

// Load environment variables
loadEnvConfig(process.cwd())

async function main() {
    console.log('Starting update of existing tenants...')

    const databaseUrl = process.env.DATABASE_URL
    if (!databaseUrl) {
        throw new Error('DATABASE_URL not found in .env')
    }

    // Connect to main DB to fetch tenants
    const prisma = new PrismaClient()

    try {
        const tenants = await prisma.tenant.findMany({
            select: {
                id: true,
                slug: true,
                databaseUrl: true,
            }
        })

        console.log(`Found ${tenants.length} tenants.`)

        // Read the SQL to apply
        const sqlPath = path.join(process.cwd(), 'prisma', 'supabase-init-restaurant.sql')
        if (!fs.existsSync(sqlPath)) {
            throw new Error(`SQL file not found at ${sqlPath}`)
        }
        const sqlContent = fs.readFileSync(sqlPath, 'utf8')
            .replace(/\r\n/g, '\n')
            .replace(/^\s*--.*$/gm, '')
            .trim()

        if (!sqlContent) {
            console.log('SQL file is empty, nothing to do.')
            return
        }

        // Iterate and update
        for (const tenant of tenants) {
            console.log(`\nProcessing tenant: ${tenant.slug} (${tenant.id})...`)

            const parts = tenant.databaseUrl.split('?')
            const baseUrl = parts[0]
            const params = new URLSearchParams(parts[1] || '')
            const schemaName = params.get('schema') || 'public'

            // Use DIRECT URL for DDL if available, otherwise base URL
            let connectionString = process.env.DIRECT_DATABASE_URL || baseUrl

            // Remove schema param from connection string as we set it via search_path
            connectionString = connectionString.split('?')[0]

            if (!connectionString.startsWith('postgres')) {
                console.log(`  Skipping (not postgres): ${tenant.databaseUrl}`)
                continue
            }

            console.log(`  Connecting to ${connectionString} (Schema: ${schemaName})...`)

            const client = new Client({ connectionString })

            try {
                await client.connect()
                await client.query(`SET search_path TO "${schemaName}"`)
                console.log(`  Applying updates...`)
                await client.query(sqlContent)
                console.log(`  ✓ Success`)
            } catch (err: any) {
                console.error(`  ❌ Failed: ${err.message}`)
            } finally {
                await client.end()
            }
        }

    } finally {
        await prisma.$disconnect()
    }
}

main().catch(e => {
    console.error(e)
    process.exit(1)
})
