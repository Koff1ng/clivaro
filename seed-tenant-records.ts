import { loadEnvConfig } from '@next/env'
loadEnvConfig(process.cwd())
import { Client } from 'pg'
import { getSchemaName } from './lib/tenant-utils'
import { prisma } from './lib/db'
import fs from 'fs'

async function main() {
    const tenants = await prisma.tenant.findMany()
    const client = new Client({ connectionString: process.env.DATABASE_URL || process.env.DIRECT_URL })
    await client.connect()

    for (const tenant of tenants) {
        const schemaName = getSchemaName(tenant.id)

        // Check if tenant record already exists in tenant schema
        const existing = await client.query(
            `SELECT id FROM "${schemaName}"."Tenant" WHERE id = $1`,
            [tenant.id]
        )

        if (existing.rows.length === 0) {
            console.log(`[${tenant.slug}] Seeding Tenant record into ${schemaName}...`)
            await client.query(
                `INSERT INTO "${schemaName}"."Tenant" 
         (id, slug, name, "databaseUrl", active, "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
         ON CONFLICT (id) DO NOTHING`,
                [tenant.id, tenant.slug, tenant.name, tenant.databaseUrl || '', tenant.active]
            )
            console.log(`  ✓ Seeded`)
        } else {
            console.log(`[${tenant.slug}] ✓ Tenant record already exists`)
        }
    }

    await client.end()
    console.log('\n[DONE]')
}

main().catch(console.error)
