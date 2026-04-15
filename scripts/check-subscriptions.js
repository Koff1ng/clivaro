const { PrismaClient } = require('@prisma/client')

async function main() {
  const prisma = new PrismaClient()
  
  try {
    const subscriptions = await prisma.subscription.findMany({
      include: {
        plan: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    console.log('\n=== ALL SUBSCRIPTIONS ===')
    console.log('Total:', subscriptions.length)
    
    for (const s of subscriptions) {
      let tenant = null
      try {
        tenant = await prisma.tenant.findUnique({ where: { id: s.tenantId }, select: { slug: true, name: true, active: true } })
      } catch {}
      
      const now = new Date()
      const expired = s.endDate && new Date(s.endDate) < now
      const trialExpired = s.status === 'trial' && s.trialEndDate && new Date(s.trialEndDate) < now
      console.log(`  Tenant: ${tenant?.slug || s.tenantId} (${tenant?.name || '?'})`)
      console.log(`    Plan: ${s.plan?.name || 'N/A'} | Status: ${s.status} | TenantActive: ${tenant?.active}`)
      console.log(`    EndDate: ${s.endDate || 'null'} ${expired ? '⚠️ EXPIRED' : '✅'}`)
      console.log(`    TrialEnd: ${s.trialEndDate || 'null'} ${trialExpired ? '⚠️ TRIAL EXPIRED' : ''}`)
      console.log('')
    }

    // Active tenants
    const tenants = await prisma.tenant.findMany({
      where: { active: true },
      select: { id: true, slug: true, name: true }
    })

    console.log('\n=== ACTIVE TENANTS ===')
    for (const t of tenants) {
      const sub = subscriptions.find(s => s.tenantId === t.id)
      console.log(`  ${t.slug} (${t.name}): ${sub ? `${sub.plan?.name} [${sub.status}]` : '❌ NO SUBSCRIPTION'}`)
    }

  } finally {
    await prisma['$disconnect']()
  }
}

main().catch(e => { console.error(e); process.exit(1) })
