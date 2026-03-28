import { PrismaClient } from '@prisma/client'
import { writeFileSync } from 'fs'

async function main() {
  const prisma = new PrismaClient()
  const log: string[] = []

  const tenants = await prisma.tenant.findMany({ select: { slug: true } })
  log.push(`Tenants: ${tenants.map(t => t.slug).join(', ')}`)

  for (const t of tenants) {
    const schema = `tenant_${t.slug}`
    try {
      await prisma.$executeRawUnsafe(`
        ALTER TABLE "${schema}"."TenantSettings"
          ADD COLUMN IF NOT EXISTS "personType" TEXT,
          ADD COLUMN IF NOT EXISTS "commercialName" TEXT,
          ADD COLUMN IF NOT EXISTS "verificationDigit" TEXT,
          ADD COLUMN IF NOT EXISTS "taxRegime" TEXT,
          ADD COLUMN IF NOT EXISTS "fiscalResponsibilities" TEXT,
          ADD COLUMN IF NOT EXISTS "economicActivity" TEXT,
          ADD COLUMN IF NOT EXISTS "businessType" TEXT,
          ADD COLUMN IF NOT EXISTS "companyCity" TEXT,
          ADD COLUMN IF NOT EXISTS "companyDepartment" TEXT
      `)
      const cols: any[] = await prisma.$queryRawUnsafe(
        `SELECT column_name FROM information_schema.columns WHERE table_schema='${schema}' AND table_name='TenantSettings' AND column_name='personType'`
      )
      log.push(`${schema}: ${cols.length === 1 ? 'OK' : 'MISSING'}`)
    } catch (e: any) {
      log.push(`${schema}: ERROR - ${e.message.slice(0, 100)}`)
    }
  }

  // Public
  try {
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "public"."TenantSettings"
        ADD COLUMN IF NOT EXISTS "personType" TEXT,
        ADD COLUMN IF NOT EXISTS "commercialName" TEXT,
        ADD COLUMN IF NOT EXISTS "verificationDigit" TEXT,
        ADD COLUMN IF NOT EXISTS "taxRegime" TEXT,
        ADD COLUMN IF NOT EXISTS "fiscalResponsibilities" TEXT,
        ADD COLUMN IF NOT EXISTS "economicActivity" TEXT,
        ADD COLUMN IF NOT EXISTS "businessType" TEXT,
        ADD COLUMN IF NOT EXISTS "companyCity" TEXT,
        ADD COLUMN IF NOT EXISTS "companyDepartment" TEXT
    `)
    log.push('public: OK')
  } catch (e: any) {
    log.push(`public: ${e.message.slice(0, 100)}`)
  }

  await prisma.$disconnect()
  log.push('Done!')
  writeFileSync('tmp/migration-result.txt', log.join('\n'))
}

main()
