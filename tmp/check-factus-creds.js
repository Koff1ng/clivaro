const { PrismaClient } = require('@prisma/client')

async function check() {
  const p = new PrismaClient()

  // Check public schema
  const all = await p.tenantSettings.findMany({
    select: {
      tenantId: true,
      factusClientId: true,
      factusClientSecret: true,
      factusUsername: true,
      factusPassword: true,
      factusSandbox: true,
    }
  })

  console.log('=== ALL TENANT SETTINGS ===')
  for (const s of all) {
    console.log(`Tenant: ${s.tenantId}`)
    console.log(`  clientId: ${s.factusClientId || '(null)'}`)
    console.log(`  secret: ${s.factusClientSecret ? s.factusClientSecret.substring(0,6)+'...' : '(null)'}`)
    console.log(`  username: ${s.factusUsername || '(null)'}`)
    console.log(`  password: ${s.factusPassword ? '***set***' : '(null)'}`)
    console.log(`  sandbox: ${s.factusSandbox}`)
  }

  // Also check tenant_prueba schema directly
  console.log('\n=== TENANT_PRUEBA SCHEMA ===')
  try {
    const rows = await p.$queryRawUnsafe(
      'SELECT "factusClientId", "factusClientSecret", "factusUsername", "factusPassword", "factusSandbox" FROM "tenant_prueba"."TenantSettings" LIMIT 1'
    )
    console.log(JSON.stringify(rows, null, 2))
  } catch (e) {
    console.log('Error querying tenant_prueba:', e.message)
  }

  await p.$disconnect()
}

check()
