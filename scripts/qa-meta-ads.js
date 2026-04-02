const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  const result = await p.subscription.updateMany({
    where: { status: 'trial' },
    data: { status: 'active' }
  });
  console.log('Updated '+result.count+' subscriptions to active');
  console.log('Total active:', await p.subscription.count({ where: { status: 'active' } }));
  await p['$disconnect']();
})();
