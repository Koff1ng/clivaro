import { Client } from 'pg'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient({ dsn: process.env.DATABASE_URL })

async function main() {
    const tenant = await prisma.tenant.findUnique({
        where: { slug: 'cafe-singular' }
    })

    const envUrlObj = new URL(process.env.DATABASE_URL!)
    envUrlObj.searchParams.set('schema', `tenant_${tenant?.id}`)
    const tenantUrl = envUrlObj.toString()

    console.log('Testing with pg using url:', tenantUrl)

    const client = new Client({ connectionString: tenantUrl })
    await client.connect()

    try {
        await client.query("BEGIN")

        const res = await client.query(`
            INSERT INTO "StockMovement" (
                "id", "warehouseId", "productId", "type", "quantity", 
                "reference", "createdById", "zoneId", "updatedAt"
            ) VALUES (
                'test-id-123', 'cmkykj4cr002ckowymgjqihct', 'test', 'IN', 1, 
                'test', 'cmkykj46n0029kowy1w49yy8e', null, now()
            ) RETURNING id
        `)

        console.log('Insert via PG succeeded:', res.rows)
        await client.query("ROLLBACK")
    } catch (err: any) {
        console.error('PG Insert Error:', err.message)
    } finally {
        await client.end()
    }

    await prisma.$disconnect()
}

main().catch(console.error)
