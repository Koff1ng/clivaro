
import { PrismaClient } from '@prisma/client'
import { Client } from 'pg'
import { loadEnvConfig } from '@next/env'
import { TENANT_SQL_STATEMENTS } from '../lib/tenant-sql-statements'

// Load environment variables
loadEnvConfig(process.cwd())

async function main() {
    console.log('🚀 Starting robust tenant synchronization...')

    const prisma = new PrismaClient()

    try {
        const tenants = await prisma.tenant.findMany({
            where: { active: true },
            select: {
                id: true,
                slug: true,
                databaseUrl: true,
            }
        })

        console.log(`🔍 Found ${tenants.length} active tenants.`)

        for (const tenant of tenants) {
            console.log(`\n📦 Processing tenant: ${tenant.slug} (${tenant.id})...`)

            const parts = tenant.databaseUrl.split('?')
            const baseUrl = parts[0]
            const queryParams = parts[1] || ''
            const params = new URLSearchParams(queryParams)
            const schemaName = params.get('schema') || 'public'

            // Use DIRECT URL for DDL to bypass PgBouncer
            let connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL || baseUrl

            // Remove schema param from connection string as we set it via search_path
            connectionString = connectionString.split('?')[0]

            const client = new Client({ connectionString })

            try {
                await client.connect()
                console.log(`  🔗 Connected to database. Ensuring schema exists: "${schemaName}"`)

                // Create schema if it doesn't exist
                await client.query(`CREATE SCHEMA IF NOT EXISTS "${schemaName}"`)

                console.log(`  🔗 Setting search_path to: "${schemaName}"`)

                // Use double quotes for schema name to handle special characters
                await client.query(`SET search_path TO "${schemaName}"`)

                let successCount = 0
                let skipCount = 0
                let errorCount = 0

                for (const statement of TENANT_SQL_STATEMENTS) {
                    try {
                        // Skip statements that might fail due to cross-schema FKs or specific environment issues
                        if (statement.includes('CONSTRAINT "TenantSettings_tenantId_fkey"')) {
                            skipCount++
                            continue
                        }

                        await client.query(statement)
                        successCount++
                    } catch (err: any) {
                        // Ignore "already exists" errors (42P07: table, 42701: column, 42P16: index/constraint)
                        if (err.code === '42P07' || err.code === '42701' || err.code === '42P16' || err.code === '42P01' || err.message.includes('already exists')) {
                            skipCount++
                        } else {
                            // Only log serious errors
                            console.error(`  ⚠️  Error in statement: ${statement.substring(0, 50).replace(/\n/g, ' ')}...`)
                            console.error(`     Code: ${err.code} | Message: ${err.message}`)
                            errorCount++
                        }
                    }
                }

                console.log(`  ✅ Finished: ${successCount} applied, ${skipCount} skipped (already there/ignored), ${errorCount} errors.`)
            } catch (err: any) {
                console.error(`  ❌ Failed to connect or initialize tenant ${tenant.slug}: ${err.message}`)
            } finally {
                await client.end()
            }
        }

    } finally {
        await prisma.$disconnect()
    }

    console.log('\n✨ Synchronization completed.')
}

main().catch(e => {
    console.error(e)
    process.exit(1)
})
