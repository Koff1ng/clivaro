const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  const c = await p['$queryRawUnsafe'](`SELECT "tenantId","adAccountId","pageId","accessToken" FROM public."MetaAdsConfig" LIMIT 5`);
  c.forEach(r => {
    console.log('tenant:'+r.tenantId);
    console.log('adAccount:'+r.adAccountId);
    console.log('pageId:'+(r.pageId||'NULL'));
    console.log('tokenLen:'+r.accessToken.length);
    console.log('tokenStart:'+r.accessToken.slice(0,10)+'...');
  });
  await p['$disconnect']();
})();
