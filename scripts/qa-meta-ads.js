const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

(async () => {
  // Check remaining master tables
  const checks = ['User', 'Plan', 'Role', 'Permission', 'Subscription', 'Account', 'Session'];
  console.log('=== MASTER TABLES STATUS ===');
  for (const table of checks) {
    try {
      const r = await p['$queryRawUnsafe'](`SELECT COUNT(*) as c FROM "public"."${table}"`);
      console.log(`  ${table}: ${Number(r[0].c)} rows`);
    } catch(e) { console.log(`  ${table}: ERROR`); }
  }

  // Check if Users exist in tenant schemas
  console.log('\n=== USERS IN tenant_prueba ===');
  try {
    const users = await p['$queryRawUnsafe'](`SELECT id, email, name, "tenantId" FROM "tenant_prueba"."User" LIMIT 5`);
    console.log(`  Found ${users.length} users:`);
    users.forEach(u => console.log(`  - ${u.email} (${u.name}) tenantId=${u.tenantId}`));
  } catch(e) { console.log('  No User table or error'); }

  // Check Plans in tenant schemas
  console.log('\n=== PLANS ===');
  try {
    const plans = await p['$queryRawUnsafe'](`SELECT id, name FROM "tenant_prueba"."Plan" LIMIT 5`);
    plans.forEach(pl => console.log(`  - ${pl.name}`));
  } catch(e) { console.log('  No Plan table or error'); }

  // Check Roles in tenant schemas
  console.log('\n=== ROLES IN tenant_prueba ===');
  try {
    const roles = await p['$queryRawUnsafe'](`SELECT id, name FROM "tenant_prueba"."Role" LIMIT 10`);
    roles.forEach(r => console.log(`  - ${r.name}`));
  } catch(e) { console.log('  No Role table or error'); }

  await p['$disconnect']();
})();
