import { PrismaClient } from '@prisma/client'

/**
 * Migrate onboarding columns to master TenantSettings table
 * Bypasses prisma db push which fails due to Supabase cross-schema reference
 */
async function main() {
  const prisma = new PrismaClient()
  
  try {
    console.log('Adding onboarding columns to TenantSettings...')
    
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "TenantSettings"
        ADD COLUMN IF NOT EXISTS "personType" TEXT,
        ADD COLUMN IF NOT EXISTS "commercialName" TEXT,
        ADD COLUMN IF NOT EXISTS "verificationDigit" TEXT,
        ADD COLUMN IF NOT EXISTS "taxRegime" TEXT,
        ADD COLUMN IF NOT EXISTS "fiscalResponsibilities" TEXT,
        ADD COLUMN IF NOT EXISTS "economicActivity" TEXT,
        ADD COLUMN IF NOT EXISTS "businessType" TEXT,
        ADD COLUMN IF NOT EXISTS "companyCity" TEXT,
        ADD COLUMN IF NOT EXISTS "companyDepartment" TEXT;
    `)
    
    console.log('✓ 9 onboarding columns added to master TenantSettings')
  } catch (err: any) {
    console.error('Error:', err.message)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()
