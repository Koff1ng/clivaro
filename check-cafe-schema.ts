import { loadEnvConfig } from '@next/env'
loadEnvConfig(process.cwd())
import { Client } from 'pg'
import { getSchemaName } from './lib/tenant-utils'
import { prisma } from './lib/db'
import fs from 'fs'

async function main() {
    const tenant = await prisma.tenant.findUnique({ where: { slug: 'cafe-singular' } })
    if (!tenant) { console.log('Tenant not found'); return }

    const schemaName = getSchemaName(tenant.id)
    const client = new Client({ connectionString: process.env.DATABASE_URL || process.env.DIRECT_URL })
    await client.connect()

    // Check if PaymentMethod table exists
    const tableRes = await client.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = $1 AND table_name = 'PaymentMethod'
  `, [schemaName])

    console.log('PaymentMethod table exists:', tableRes.rows.length > 0)

    // Check what tables exist
    const allTables = await client.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = $1
    ORDER BY table_name
  `, [schemaName])

    const result = {
        schema: schemaName,
        paymentMethodTableExists: tableRes.rows.length > 0,
        allTables: allTables.rows.map(r => r.table_name)
    }

    fs.writeFileSync('cafe-schema-check.json', JSON.stringify(result, null, 2))
    console.log('Saved to cafe-schema-check.json')
    await client.end()
}

main().catch(console.error)
