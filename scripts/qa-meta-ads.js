const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  try {
    const configs = await p['$queryRawUnsafe'](`SELECT "tenantId","adAccountId","pageId" FROM public."MetaAdsConfig" LIMIT 5`);
    console.log('MetaAdsConfig rows:', configs.length);
    configs.forEach(r => console.log('  tenant:'+r.tenantId+' adAccount:'+r.adAccountId));
  } catch(e) { console.log('MetaAdsConfig ERR:'+e.message.slice(0,80)); }
  try {
    const t = await p['$queryRawUnsafe'](`SELECT id,slug FROM public."Tenant" WHERE slug='prueba'`);
    console.log('Tenant prueba:', t[0]||'NOT FOUND');
  } catch(e) { console.log('Tenant ERR:'+e.message.slice(0,80)); }
  await p['$disconnect']();
})();
