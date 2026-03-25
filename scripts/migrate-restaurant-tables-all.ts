import { PrismaClient } from '@prisma/client'
import { Client } from 'pg'

const prisma = new PrismaClient()

const RESTAURANT_TABLES_SQL = `
-- RestaurantConfig
CREATE TABLE IF NOT EXISTS "RestaurantConfig" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT false,
  "alegraBusinessId" TEXT,
  "alegraEmail" TEXT,
  "alegraToken" TEXT,
  "alegraEnabled" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RestaurantConfig_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "RestaurantConfig_tenantId_key" ON "RestaurantConfig"("tenantId");

-- RestaurantZone
CREATE TABLE IF NOT EXISTS "RestaurantZone" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RestaurantZone_pkey" PRIMARY KEY ("id")
);

-- RestaurantTable
CREATE TABLE IF NOT EXISTS "RestaurantTable" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "zoneId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "capacity" INTEGER NOT NULL DEFAULT 2,
  "status" TEXT NOT NULL DEFAULT 'AVAILABLE',
  "x" INTEGER NOT NULL DEFAULT 0,
  "y" INTEGER NOT NULL DEFAULT 0,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RestaurantTable_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "RestaurantTable_tenantId_idx" ON "RestaurantTable"("tenantId");

-- WaiterProfile
CREATE TABLE IF NOT EXISTS "WaiterProfile" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "pin" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "lastLogin" TIMESTAMP(3),
  "failedAttempts" INTEGER NOT NULL DEFAULT 0,
  "lockedUntil" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WaiterProfile_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "WaiterProfile_tenantId_code_key" ON "WaiterProfile"("tenantId", "code");
CREATE INDEX IF NOT EXISTS "WaiterProfile_tenantId_idx" ON "WaiterProfile"("tenantId");

-- TableSession
CREATE TABLE IF NOT EXISTS "TableSession" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "tableId" TEXT NOT NULL,
  "waiterId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "closedAt" TIMESTAMP(3),
  "totalAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "tipAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TableSession_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "TableSession_tenantId_status_idx" ON "TableSession"("tenantId", "status");
CREATE INDEX IF NOT EXISTS "TableSession_tableId_idx" ON "TableSession"("tableId");

-- TableOrder
CREATE TABLE IF NOT EXISTS "TableOrder" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "waiterId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TableOrder_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "TableOrder_sessionId_idx" ON "TableOrder"("sessionId");

-- TableOrderLine
CREATE TABLE IF NOT EXISTS "TableOrderLine" (
  "id" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "variantId" TEXT,
  "quantity" DOUBLE PRECISION NOT NULL,
  "unitPrice" DOUBLE PRECISION NOT NULL,
  "notes" TEXT,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TableOrderLine_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "TableOrderLine_orderId_idx" ON "TableOrderLine"("orderId");

-- TenantEmailConfig (in public schema, not tenant schema)
-- Foreign Keys
ALTER TABLE "RestaurantTable" DROP CONSTRAINT IF EXISTS "RestaurantTable_zoneId_fkey";
ALTER TABLE "RestaurantTable" ADD CONSTRAINT "RestaurantTable_zoneId_fkey" 
  FOREIGN KEY ("zoneId") REFERENCES "RestaurantZone"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TableSession" DROP CONSTRAINT IF EXISTS "TableSession_tableId_fkey";
ALTER TABLE "TableSession" ADD CONSTRAINT "TableSession_tableId_fkey" 
  FOREIGN KEY ("tableId") REFERENCES "RestaurantTable"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "TableSession" DROP CONSTRAINT IF EXISTS "TableSession_waiterId_fkey";
ALTER TABLE "TableSession" ADD CONSTRAINT "TableSession_waiterId_fkey" 
  FOREIGN KEY ("waiterId") REFERENCES "WaiterProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "TableOrder" DROP CONSTRAINT IF EXISTS "TableOrder_sessionId_fkey";
ALTER TABLE "TableOrder" ADD CONSTRAINT "TableOrder_sessionId_fkey" 
  FOREIGN KEY ("sessionId") REFERENCES "TableSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TableOrder" DROP CONSTRAINT IF EXISTS "TableOrder_waiterId_fkey";
ALTER TABLE "TableOrder" ADD CONSTRAINT "TableOrder_waiterId_fkey" 
  FOREIGN KEY ("waiterId") REFERENCES "WaiterProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "TableOrderLine" DROP CONSTRAINT IF EXISTS "TableOrderLine_orderId_fkey";
ALTER TABLE "TableOrderLine" ADD CONSTRAINT "TableOrderLine_orderId_fkey" 
  FOREIGN KEY ("orderId") REFERENCES "TableOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TableOrderLine" DROP CONSTRAINT IF EXISTS "TableOrderLine_productId_fkey";
ALTER TABLE "TableOrderLine" ADD CONSTRAINT "TableOrderLine_productId_fkey" 
  FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
`

const PUBLIC_TABLES_SQL = `
-- TenantEmailConfig in public schema
CREATE TABLE IF NOT EXISTS "TenantEmailConfig" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "resendDomainId" TEXT NOT NULL,
  "domain" TEXT NOT NULL,
  "fromEmail" TEXT NOT NULL,
  "fromName" TEXT NOT NULL,
  "dnsRecords" JSONB NOT NULL,
  "verified" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TenantEmailConfig_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "TenantEmailConfig_tenantId_key" ON "TenantEmailConfig"("tenantId");
ALTER TABLE "TenantEmailConfig" DROP CONSTRAINT IF EXISTS "TenantEmailConfig_tenantId_fkey";
ALTER TABLE "TenantEmailConfig" ADD CONSTRAINT "TenantEmailConfig_tenantId_fkey" 
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
`

async function main() {
  // 1. Create TenantEmailConfig in public schema
  console.log('=== Creating TenantEmailConfig in public schema ===')
  const baseUrl = process.env.DATABASE_URL || process.env.DIRECT_URL || ''
  const publicClient = new Client({ connectionString: baseUrl })
  await publicClient.connect()
  try {
    await publicClient.query(PUBLIC_TABLES_SQL)
    console.log('✅ TenantEmailConfig created/verified in public schema')
  } catch (e: any) {
    console.log('⚠️ Public schema error:', e.message)
  }
  await publicClient.end()

  // 2. Get all tenants and create restaurant tables in each
  const tenants = await prisma.tenant.findMany({ where: { active: true } })
  console.log(`\n=== Migrating ${tenants.length} tenant schemas ===\n`)

  for (const tenant of tenants) {
    const schemaName = `tenant_${tenant.id.toLowerCase().replace(/[^a-z0-9]/g, '_')}`
    console.log(`--- ${tenant.name} (${schemaName}) ---`)

    const client = new Client({ connectionString: baseUrl })
    await client.connect()

    try {
      // Check schema exists
      const schemaCheck = await client.query(
        `SELECT 1 FROM information_schema.schemata WHERE schema_name = $1`, [schemaName]
      )
      if (!schemaCheck.rowCount || schemaCheck.rowCount === 0) {
        console.log(`⚠️ Schema ${schemaName} does not exist, skipping`)
        await client.end()
        continue
      }

      // Set search path to tenant schema
      await client.query(`SET search_path TO "${schemaName}"`)

      // Execute restaurant tables SQL
      await client.query(RESTAURANT_TABLES_SQL)
      console.log(`✅ Restaurant tables created/verified`)

      // Verify
      const tables = await client.query(`
        SELECT table_name FROM information_schema.tables 
        WHERE table_schema = $1 AND table_name IN ('RestaurantConfig', 'RestaurantZone', 'RestaurantTable', 'WaiterProfile', 'TableSession', 'TableOrder', 'TableOrderLine')
      `, [schemaName])
      console.log(`   Found ${tables.rowCount}/7 restaurant tables`)

    } catch (e: any) {
      console.log(`❌ Error: ${e.message}`)
    }

    await client.end()
  }

  await prisma.$disconnect()
  console.log('\n✅ Migration complete!')
}

main().catch(console.error)
