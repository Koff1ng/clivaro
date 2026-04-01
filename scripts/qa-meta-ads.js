const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function verify() {
  try {
    const c1 = await prisma.metaAdsConfig.findMany();
    console.log('MetaAdsConfig: OK, rows=' + c1.length);
  } catch (e) { console.log('MetaAdsConfig: FAIL -', e.message.split('\n').pop()); }

  try {
    const c2 = await prisma.metaAdsCampaign.findMany();
    console.log('MetaAdsCampaign: OK, rows=' + c2.length);
  } catch (e) { console.log('MetaAdsCampaign: FAIL -', e.message.split('\n').pop()); }

  try {
    const t = await prisma.metaAdsConfig.create({ data: { tenantId: '__v__', accessToken: 'x', adAccountId: 'act_x' }});
    await prisma.metaAdsConfig.delete({ where: { id: t.id }});
    console.log('CRUD Config: OK');
  } catch (e) { console.log('CRUD Config: FAIL -', e.message.split('\n').pop()); }

  try {
    const t = await prisma.metaAdsCampaign.create({ data: { tenantId: '__v__', trackingId: 'v1', name: 'V', objective: 'X', dailyBudget: 1, payload: {}, createdById: 'v' }});
    await prisma.metaAdsCampaign.update({ where: { id: t.id }, data: { status: 'ACTIVE' }});
    await prisma.metaAdsCampaign.delete({ where: { id: t.id }});
    console.log('CRUD Campaign: OK');
  } catch (e) { console.log('CRUD Campaign: FAIL -', e.message.split('\n').pop()); }

  await prisma['$disconnect']();
}
verify();
