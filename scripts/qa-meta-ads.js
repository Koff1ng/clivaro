const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  console.log('Plans:' + await p.plan.count());
  console.log('Subs:' + await p.subscription.count());
  await p['$disconnect']();
})();
