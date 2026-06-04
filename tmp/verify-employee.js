const { Client } = require('pg')
async function main() {
  const c = new Client({ connectionString: process.env.DIRECT_URL })
  await c.connect()
  const r = await c.query('SELECT "id","firstName","lastName","riskLevel","contractType","integralSalary" FROM "tenant_prueba"."Employee" LIMIT 5')
  console.log('Query OK, rows:', r.rowCount)
  r.rows.forEach(e => console.log('  ' + e.firstName + ' ' + e.lastName + ' risk=' + e.riskLevel + ' contract=' + e.contractType + ' integral=' + e.integralSalary))
  await c.end()
}
main().catch(e => { console.error('ERROR:', e.message); process.exit(1) })
