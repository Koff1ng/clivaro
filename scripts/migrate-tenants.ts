import { prisma as masterPrisma } from '../lib/db'
import { execSync } from 'child_process'
import * as fs from 'fs'
import * as path from 'path'

/**
 * Migration Runner for Multi-Tenant Postgres (Supabase)
 * 
 * This script:
 * 1. Fetches all active tenants from the public schema.
 * 2. Applies migrations to each tenant schema (tenant_<id>).
 * 3. Logs success/failure per tenant.
 * 4. Is idempotent and safe to rerun.
 */
async function migrateTenants() {
    console.log('🚀 Starting Multi-Tenant Migration Runner...')

    try {
        // 1. Get all tenants
        const tenants = await masterPrisma.tenant.findMany({
            where: { active: true },
            select: { id: true, name: true, slug: true }
        })

        console.log(`🔍 Found ${tenants.length} active tenants.`)

        const results = {
            success: [] as string[],
            failed: [] as { id: string; error: string }[]
        }

        // 2. Apply migrations to each tenant
        for (const tenant of tenants) {
            const schemaName = `tenant_${tenant.id}`
            console.log(`\n📦 Migrating tenant: ${tenant.name} [${tenant.slug}] (Schema: ${schemaName})`)

            try {
                // Set environment variable for this specific migration run
                // We use DATABASE_URL with the schema parameter to force Prisma 
                // to run migrations against the specific tenant schema.
                const baseUrl = process.env.DIRECT_URL || process.env.DATABASE_URL
                if (!baseUrl) throw new Error('DATABASE_URL or DIRECT_URL is not defined.')

                const dbUrl = new URL(baseUrl)
                dbUrl.searchParams.set('schema', schemaName)

                // Ensure schema exists first
                await masterPrisma.$executeRawUnsafe(`CREATE SCHEMA IF NOT EXISTS "${schemaName}";`)

                // Run prisma migrate deploy
                // We use --schema to point to the correct prisma file
                // In this project, we might need a specific one for postgres if it differs from the default
                const result = execSync('npx prisma migrate deploy', {
                    env: {
                        ...process.env,
                        DATABASE_URL: dbUrl.toString(),
                    },
                    stdio: 'inherit'
                })

                console.log(`✅ Tenant ${tenant.slug} migrated successfully.`)
                results.success.push(tenant.id)
            } catch (error: any) {
                console.error(`❌ Failed to migrate tenant ${tenant.slug}:`, error.message)
                results.failed.push({ id: tenant.id, error: error.message })
            }
        }

        // Summary
        console.log('\n' + '='.repeat(40))
        console.log('📊 MIGRATION SUMMARY')
        console.log('='.repeat(40))
        console.log(`Total Tenants: ${tenants.length}`)
        console.log(`Success:       ${results.success.length}`)
        console.log(`Failed:        ${results.failed.length}`)

        if (results.failed.length > 0) {
            console.log('\nErrors:')
            results.failed.forEach(f => console.log(`- ${f.id}: ${f.error}`))
            process.exit(1)
        }

        console.log('\n✨ All migrations completed successfully.')
    } catch (error: any) {
        console.error('💥 Critical error in migration runner:', error.message)
        process.exit(1)
    }
}

migrateTenants()
