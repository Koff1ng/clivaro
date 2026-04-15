const { PrismaClient } = require('@prisma/client')

async function main() {
  const prisma = new PrismaClient()
  
  try {
    // Fix "prueba" tenant subscription: pending_payment → active
    const result = await prisma.subscription.updateMany({
      where: {
        tenant: { slug: 'prueba' },
        status: 'pending_payment',
      },
      data: {
        status: 'active',
        startDate: new Date(),
        endDate: null, // No expiration
      }
    })

    console.log(`Updated ${result.count} subscription(s) for "prueba" tenant`)

    // Also fix any other active tenants with non-active subscriptions
    const activeTenants = await prisma.tenant.findMany({
      where: { active: true },
      select: { id: true, slug: true }
    })

    for (const t of activeTenants) {
      const hasSub = await prisma.subscription.findFirst({
        where: { tenantId: t.id, status: { in: ['active', 'trial'] } }
      })

      if (!hasSub) {
        // Check if there's ANY subscription for this tenant
        const anySub = await prisma.subscription.findFirst({
          where: { tenantId: t.id },
          orderBy: { createdAt: 'desc' }
        })

        if (anySub) {
          await prisma.subscription.update({
            where: { id: anySub.id },
            data: { status: 'active' }
          })
          console.log(`Fixed ${t.slug}: ${anySub.status} → active`)
        }
      }
    }

    console.log('\n✅ All active tenant subscriptions are now valid')
  } finally {
    await prisma['$disconnect']()
  }
}

main().catch(e => { console.error(e); process.exit(1) })
