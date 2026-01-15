import { PrismaClient } from '@prisma/client'
import { getTenantPrisma } from '@/lib/tenant-db'

/**
 * Backfill permissions related to returns/voiding invoices across:
 * - master DB (for consistency)
 * - all active tenant DBs
 */
async function upsertPerms(db: PrismaClient) {
  const perms = [
    { name: 'manage_returns', description: 'Manage returns and refunds' },
    { name: 'void_invoices', description: 'Void/cancel invoices (with reason)' },
    { name: 'apply_discounts', description: 'Apply discounts in POS and sales' },
  ]

  for (const p of perms) {
    await db.permission.upsert({
      where: { name: p.name },
      update: { description: p.description },
      create: p,
    })
  }

  // Assign to roles (ADMIN, MANAGER)
  const roles = await db.role.findMany({
    where: { name: { in: ['ADMIN', 'MANAGER'] } },
  })
  const all = await db.permission.findMany({
    where: { name: { in: perms.map(p => p.name) } },
  })

  for (const r of roles) {
    for (const p of all) {
      await db.rolePermission.upsert({
        where: {
          roleId_permissionId: { roleId: r.id, permissionId: p.id },
        },
        update: {},
        create: { roleId: r.id, permissionId: p.id },
      })
    }
  }
}

async function main() {
  const master = new PrismaClient()

  try {
    console.log('[returns-permissions] Updating master DB...')
    await upsertPerms(master)
    console.log('[returns-permissions] Master OK')

    // If Tenant model exists, backfill tenants too (multi-tenant setup)
    const tenants = await (master as any).tenant?.findMany?.({ where: { active: true } })
    if (!Array.isArray(tenants) || tenants.length === 0) {
      console.log('[returns-permissions] No tenants found (or multi-tenant not enabled). Done.')
      return
    }

    console.log(`[returns-permissions] Updating ${tenants.length} tenant DB(s)...`)
    for (const t of tenants) {
      try {
        const tp = getTenantPrisma(t.databaseUrl)
        await upsertPerms(tp as any)
        console.log(`[returns-permissions] Tenant OK: ${t.slug || t.name || t.id}`)
      } catch (e: any) {
        console.error(`[returns-permissions] Tenant FAILED: ${t.slug || t.name || t.id}`, e?.message || e)
      }
    }
  } finally {
    await master.$disconnect()
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})


