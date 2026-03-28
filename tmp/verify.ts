import { Client } from 'pg'
import { config } from 'dotenv'
config()

async function verify() {
  const c = new Client({ connectionString: process.env.DATABASE_URL })
  await c.connect()
  
  const r = await c.query(
    `SELECT column_name FROM information_schema.columns 
     WHERE table_schema='tenant_prueba' AND table_name='TenantSettings' 
     AND column_name IN ('personType','commercialName','verificationDigit','taxRegime','fiscalResponsibilities','economicActivity','businessType','companyCity','companyDepartment')
     ORDER BY column_name`
  )
  console.log(`tenant_prueba: ${r.rowCount}/9 columns found`)
  r.rows.forEach(row => console.log(`  ✓ ${row.column_name}`))
  
  await c.end()
}

verify().catch(e => { console.error('ERROR:', e.message); process.exit(1) })
