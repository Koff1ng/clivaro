import { Client } from 'pg'

async function check() {
  const c = new Client({ connectionString: process.env.DATABASE_URL })
  await c.connect()
  const r = await c.query(`
    SELECT column_name 
    FROM information_schema.columns 
    WHERE table_schema = 'tenant_prueba' 
      AND table_name = 'TenantSettings' 
      AND column_name IN ('personType','commercialName','verificationDigit','taxRegime','fiscalResponsibilities','economicActivity','businessType','companyCity','companyDepartment') 
    ORDER BY column_name
  `)
  console.log('Columns found in tenant_prueba.TenantSettings:')
  r.rows.forEach(row => console.log('  ✓', row.column_name))
  console.log(`Total: ${r.rowCount}/9`)
  await c.end()
}
check()
