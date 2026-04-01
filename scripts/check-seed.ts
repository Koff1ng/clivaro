const { PrismaClient } = require('@prisma/client')
const url = new URL(process.env.DATABASE_URL)
url.searchParams.set('schema', 'tenant_prueba')
const p = new PrismaClient({ datasources: { db: { url: url.toString() } } })

async function check() {
  const count = await p.product.count()
  console.log('Total products in tenant_prueba:', count)
  const sample = await p.product.findMany({ select: { sku: true, name: true, category: true, price: true }, take: 5, orderBy: { sku: 'asc' } })
  console.log('Sample:')
  sample.forEach((s: any) => console.log(`  ${s.sku} | ${s.name} | ${s.category} | $${s.price.toLocaleString()}`))
  await p.$disconnect()
}
check().catch(e => { console.error(e); process.exit(1) })
