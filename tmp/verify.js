const { Client } = require('pg')

async function verify() {
  const c = new Client({ connectionString: process.env.DATABASE_URL })
  await c.connect()
  
  // Check tenant_prueba
  const r = await c.query(
    `SELECT column_name FROM information_schema.columns 
     WHERE table_schema='tenant_prueba' AND table_name='TenantSettings' 
     AND column_name IN ('personType','commercialName','verificationDigit','taxRegime','fiscalResponsibilities','economicActivity','businessType','companyCity','companyDepartment')
     ORDER BY column_name`
  )
  console.log('tenant_prueba columns found:', r.rowCount, '/ 9')
  r.rows.forEach(row => console.log('  ✓', row.column_name))

  // Check public
  const p = await c.query(
    `SELECT column_name FROM information_schema.columns 
     WHERE table_schema='public' AND table_name='TenantSettings' 
     AND column_name='personType'`
  )
  console.log('public.TenantSettings personType:', p.rowCount === 1 ? '✓' : '✗ MISSING')
  
  await c.end()
}

verify().catch(e => { console.error(e.message); process.exit(1) })
