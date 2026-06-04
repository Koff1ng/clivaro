// Env vars loaded externally
const { Client } = require('pg')

async function main() {
  const client = new Client({ connectionString: process.env.DIRECT_URL })
  await client.connect()

  // 1. Check if Employee table exists
  const tableCheck = await client.query(
    "SELECT table_name FROM information_schema.tables WHERE table_schema = 'tenant_prueba' AND table_name = 'Employee'"
  )
  console.log('Employee table exists:', tableCheck.rowCount > 0)

  if (tableCheck.rowCount === 0) {
    console.log('\nEmployee table DOES NOT EXIST in tenant_prueba schema!')
    await client.end()
    return
  }

  // 2. Check columns
  const columns = await client.query(
    "SELECT column_name, data_type FROM information_schema.columns WHERE table_schema = 'tenant_prueba' AND table_name = 'Employee' ORDER BY ordinal_position"
  )
  console.log('\nEmployee columns (' + columns.rowCount + '):')
  columns.rows.forEach(c => console.log('  ' + c.column_name + ' (' + c.data_type + ')'))

  // 3. Check for missing columns
  const expected = [
    'id','tenantId','documentType','documentNumber','firstName','lastName',
    'email','phone','address','jobTitle','department','hireDate',
    'baseSalary','salaryType','bankName','bankAccountType','bankAccountNumber',
    'healthEntity','pensionEntity','arlEntity','compensationBox','paymentMethod',
    'riskLevel','contractType','workerType','workerSubType','municipality',
    'integralSalary','isActive','createdAt','updatedAt'
  ]
  const existing = columns.rows.map(c => c.column_name)
  const missing = expected.filter(c => !existing.includes(c))
  if (missing.length > 0) {
    console.log('\nMISSING COLUMNS:', missing.join(', '))
  } else {
    console.log('\nAll expected columns present')
  }

  // 4. Check Tenant record
  const tenants = await client.query('SELECT id, name FROM "tenant_prueba"."Tenant" LIMIT 5')
  console.log('\nTenant records:', tenants.rowCount)
  tenants.rows.forEach(t => console.log('  ' + t.id + ' - ' + t.name))

  // 5. Count employees
  const cnt = await client.query('SELECT COUNT(*) as c FROM "tenant_prueba"."Employee"')
  console.log('\nEmployee count:', cnt.rows[0].c)

  // 6. List all schemas that have Employee table
  const schemas = await client.query(
    "SELECT table_schema FROM information_schema.tables WHERE table_name = 'Employee' ORDER BY table_schema"
  )
  console.log('\nSchemas with Employee table:')
  schemas.rows.forEach(s => console.log('  ' + s.table_schema))

  await client.end()
}

main().catch(e => { console.error('ERROR:', e.message); process.exit(1) })
