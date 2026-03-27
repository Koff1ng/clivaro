const { PrismaClient } = require('@prisma/client')

async function fix() {
  const p = new PrismaClient()

  // Fix the password - remove leading tab
  console.log('Fixing factusPassword for tenant_prueba...')
  await p.$executeRawUnsafe(`
    UPDATE "tenant_prueba"."TenantSettings"
    SET "factusPassword" = 'sandbox2024%'
    WHERE "factusPassword" LIKE E'\\t%' OR "factusPassword" LIKE ' %'
  `)
  console.log('Fixed!')

  // Verify
  const rows = await p.$queryRawUnsafe(
    'SELECT "factusClientId", "factusUsername", "factusPassword", "factusSandbox" FROM "tenant_prueba"."TenantSettings" LIMIT 1'
  )
  console.log('Verified:', JSON.stringify(rows, null, 2))

  // Quick auth test
  console.log('\nTesting Factus auth...')
  const formData = new URLSearchParams()
  formData.append('grant_type', 'password')
  formData.append('client_id', rows[0].factusClientId)
  formData.append('client_secret', '2P2t1k4PF0KDCwU7gGdtiX9smhkcvTWLHeddzpNa')
  formData.append('username', rows[0].factusUsername)
  formData.append('password', rows[0].factusPassword)

  const res = await fetch('https://api-sandbox.factus.com.co/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: formData.toString(),
  })
  const data = await res.json()
  console.log('Auth result:', res.status, data.token_type || data.error || JSON.stringify(data))

  await p.$disconnect()
}

fix()
