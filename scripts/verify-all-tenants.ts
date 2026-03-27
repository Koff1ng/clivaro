import { PrismaClient } from '@prisma/client'
import { Client } from 'pg'
import * as fs from 'fs'

const prisma = new PrismaClient()

async function main() {
  const results: any = {}
  const tenants = await prisma.tenant.findMany({ where: { active: true } })

  for (const tenant of tenants) {
    const client = new Client({ connectionString: tenant.databaseUrl })
    await client.connect()

    const schemaId = `tenant_${tenant.id}`
    let urlSchema = 'public'
    try { urlSchema = new URL(tenant.databaseUrl).searchParams.get('schema') || 'public' } catch {}

    const entry: any = { urlSchema, schemaId, urlSchemaExists: false, idSchemaExists: false, products: [] }

    const urlCheck = await client.query(`SELECT 1 FROM information_schema.schemata WHERE schema_name = $1`, [urlSchema])
    entry.urlSchemaExists = (urlCheck.rowCount || 0) > 0

    const idCheck = await client.query(`SELECT 1 FROM information_schema.schemata WHERE schema_name = $1`, [schemaId])
    entry.idSchemaExists = (idCheck.rowCount || 0) > 0

    try {
      const products = await client.query(`SELECT "sku", "name", "price", "cost" FROM "${schemaId}"."Product" WHERE "active" = true ORDER BY "sku"`)
      entry.products = products.rows
    } catch (e: any) {
      entry.productsError = e.message
    }

    results[`${tenant.name} (${tenant.slug})`] = entry
    await client.end()
  }

  fs.writeFileSync('verify_results.json', JSON.stringify(results, null, 2), 'utf-8')
  await prisma.$disconnect()
}

main().catch(console.error)
