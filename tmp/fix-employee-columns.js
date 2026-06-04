// Env vars loaded externally
const { Client } = require('pg')

async function main() {
  const client = new Client({ connectionString: process.env.DIRECT_URL })
  await client.connect()

  // Get all tenant schemas that have Employee table
  const schemas = await client.query(
    "SELECT table_schema FROM information_schema.tables WHERE table_name = 'Employee' ORDER BY table_schema"
  )
  
  console.log('Schemas with Employee table:', schemas.rows.map(s => s.table_schema).join(', '))

  for (const row of schemas.rows) {
    const schema = row.table_schema
    if (schema === 'public') continue // skip public schema
    
    console.log('\n--- Fixing schema: ' + schema + ' ---')
    
    try {
      await client.query('SET search_path TO "' + schema + '"')
      
      // Add missing columns from Prisma schema
      await client.query('ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "riskLevel" INTEGER NOT NULL DEFAULT 1')
      await client.query('ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "contractType" TEXT NOT NULL DEFAULT \'INDEFINIDO\'')
      await client.query('ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "workerType" TEXT NOT NULL DEFAULT \'01\'')
      await client.query('ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "workerSubType" TEXT NOT NULL DEFAULT \'00\'')
      await client.query('ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "municipality" TEXT')
      await client.query('ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "integralSalary" BOOLEAN NOT NULL DEFAULT false')
      
      // Also fix PayrollPeriod and PayslipItem if they exist
      await client.query('ALTER TABLE "PayrollPeriod" ADD COLUMN IF NOT EXISTS "transmittedAt" TIMESTAMP(3)')
      await client.query('ALTER TABLE "PayslipItem" ADD COLUMN IF NOT EXISTS "percentage" DOUBLE PRECISION')
      
      console.log('  OK - all columns synced')
      
      // Verify
      const cols = await client.query(
        "SELECT column_name FROM information_schema.columns WHERE table_schema = '" + schema + "' AND table_name = 'Employee' ORDER BY ordinal_position"
      )
      console.log('  Employee now has ' + cols.rowCount + ' columns')
      
    } catch (e) {
      console.log('  ERROR: ' + e.message)
    }
  }
  
  // Reset search_path
  await client.query('SET search_path TO public')
  await client.end()
  console.log('\nDone!')
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1) })
