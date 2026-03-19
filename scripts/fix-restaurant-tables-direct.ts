/**
 * Direct migration script — creates restaurant tables in a specific tenant schema
 * Uses DIRECT_URL (bypasses PgBouncer) for DDL compatibility
 */
import { Client } from 'pg'

const DIRECT_URL = process.env.DIRECT_URL || 'postgresql://postgres:cartuchera123@db.kkylpwgoxymskhblorsz.supabase.co:5432/postgres'
const TENANT_SCHEMA = 'tenant_cmmirnniw0000ceqllfbm7kiv'

const RESTAURANT_STATEMENTS = [
  // Tables
  `CREATE TABLE IF NOT EXISTS "RestaurantConfig" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "alegraEnabled" BOOLEAN NOT NULL DEFAULT false,
    "alegraBusinessId" TEXT,
    "alegraEmail" TEXT,
    "alegraToken" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RestaurantConfig_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE TABLE IF NOT EXISTS "RestaurantZone" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RestaurantZone_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE TABLE IF NOT EXISTS "RestaurantTable" (
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
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RestaurantTable_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE TABLE IF NOT EXISTS "WaiterProfile" (
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
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WaiterProfile_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE TABLE IF NOT EXISTS "TableSession" (
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
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TableSession_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE TABLE IF NOT EXISTS "TableOrder" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "waiterId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TableOrder_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE TABLE IF NOT EXISTS "TableOrderLine" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "variantId" TEXT,
    "quantity" DOUBLE PRECISION NOT NULL,
    "unitPrice" DOUBLE PRECISION NOT NULL,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TableOrderLine_pkey" PRIMARY KEY ("id")
  )`,

  // Indexes
  `CREATE UNIQUE INDEX IF NOT EXISTS "RestaurantConfig_tenantId_key" ON "RestaurantConfig"("tenantId")`,
  `CREATE INDEX IF NOT EXISTS "RestaurantZone_tenantId_idx" ON "RestaurantZone"("tenantId")`,
  `CREATE INDEX IF NOT EXISTS "RestaurantTable_tenantId_idx" ON "RestaurantTable"("tenantId")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "WaiterProfile_tenantId_code_key" ON "WaiterProfile"("tenantId", "code")`,
  `CREATE INDEX IF NOT EXISTS "WaiterProfile_tenantId_idx" ON "WaiterProfile"("tenantId")`,
  `CREATE INDEX IF NOT EXISTS "TableSession_tenantId_status_idx" ON "TableSession"("tenantId", "status")`,
  `CREATE INDEX IF NOT EXISTS "TableSession_tableId_idx" ON "TableSession"("tableId")`,
  `CREATE INDEX IF NOT EXISTS "TableOrder_sessionId_idx" ON "TableOrder"("sessionId")`,
  `CREATE INDEX IF NOT EXISTS "TableOrderLine_orderId_idx" ON "TableOrderLine"("orderId")`,

  // Also add missing columns to existing tables
  `ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "tipAmount" DOUBLE PRECISION NOT NULL DEFAULT 0`,
  `ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "isRetentionAgent" BOOLEAN NOT NULL DEFAULT false`,
]

// Foreign keys — wrapped in DO blocks to handle "already exists" gracefully
const FK_STATEMENTS = [
  `DO $$ BEGIN ALTER TABLE "RestaurantConfig" ADD CONSTRAINT "RestaurantConfig_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  `DO $$ BEGIN ALTER TABLE "RestaurantZone" ADD CONSTRAINT "RestaurantZone_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  `DO $$ BEGIN ALTER TABLE "RestaurantTable" ADD CONSTRAINT "RestaurantTable_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  `DO $$ BEGIN ALTER TABLE "RestaurantTable" ADD CONSTRAINT "RestaurantTable_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "RestaurantZone"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  `DO $$ BEGIN ALTER TABLE "WaiterProfile" ADD CONSTRAINT "WaiterProfile_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  `DO $$ BEGIN ALTER TABLE "TableSession" ADD CONSTRAINT "TableSession_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  `DO $$ BEGIN ALTER TABLE "TableSession" ADD CONSTRAINT "TableSession_tableId_fkey" FOREIGN KEY ("tableId") REFERENCES "RestaurantTable"("id") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  `DO $$ BEGIN ALTER TABLE "TableSession" ADD CONSTRAINT "TableSession_waiterId_fkey" FOREIGN KEY ("waiterId") REFERENCES "WaiterProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  `DO $$ BEGIN ALTER TABLE "TableOrder" ADD CONSTRAINT "TableOrder_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  `DO $$ BEGIN ALTER TABLE "TableOrder" ADD CONSTRAINT "TableOrder_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "TableSession"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  `DO $$ BEGIN ALTER TABLE "TableOrder" ADD CONSTRAINT "TableOrder_waiterId_fkey" FOREIGN KEY ("waiterId") REFERENCES "WaiterProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  `DO $$ BEGIN ALTER TABLE "TableOrderLine" ADD CONSTRAINT "TableOrderLine_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "TableOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  `DO $$ BEGIN ALTER TABLE "TableOrderLine" ADD CONSTRAINT "TableOrderLine_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
]

async function main() {
  console.log(`🔌 Conectando a Supabase directamente (DIRECT_URL, sin PgBouncer)...`)
  console.log(`📋 Schema objetivo: ${TENANT_SCHEMA}`)

  const client = new Client({ connectionString: DIRECT_URL })

  try {
    await client.connect()
    console.log('✅ Conectado')

    // Check schema exists
    const schemaCheck = await client.query(
      `SELECT 1 FROM information_schema.schemata WHERE schema_name = $1`,
      [TENANT_SCHEMA]
    )
    if (schemaCheck.rows.length === 0) {
      console.error(`❌ Schema "${TENANT_SCHEMA}" NO existe en la BD`)
      process.exit(1)
    }
    console.log(`✅ Schema "${TENANT_SCHEMA}" existe`)

    // Set search path
    await client.query(`SET search_path TO "${TENANT_SCHEMA}"`)
    console.log(`✅ search_path = "${TENANT_SCHEMA}"`)

    // Check what tables exist before
    const beforeTables = await client.query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = $1 ORDER BY table_name
    `, [TENANT_SCHEMA])
    console.log(`\n📊 Tablas actuales (${beforeTables.rows.length}):`)
    beforeTables.rows.forEach(r => console.log(`   - ${r.table_name}`))

    // Execute restaurant statements
    console.log(`\n🔧 Ejecutando ${RESTAURANT_STATEMENTS.length} statements DDL...`)
    let ok = 0, skip = 0
    for (const stmt of RESTAURANT_STATEMENTS) {
      try {
        await client.query(stmt)
        ok++
        const tableName = stmt.match(/"(\w+)"/)?.[1] || 'unknown'
        console.log(`   ✅ ${tableName}`)
      } catch (err: any) {
        if (err.message?.includes('already exists')) {
          skip++
        } else {
          console.error(`   ❌ Error: ${err.message}`)
          console.error(`   Statement: ${stmt.substring(0, 100)}...`)
        }
      }
    }
    console.log(`\n📊 DDL: ${ok} ejecutados, ${skip} ya existían`)

    // Execute FK statements
    console.log(`\n🔗 Ejecutando ${FK_STATEMENTS.length} foreign keys...`)
    let fkOk = 0
    for (const stmt of FK_STATEMENTS) {
      try {
        await client.query(stmt)
        fkOk++
      } catch (err: any) {
        console.error(`   ❌ FK Error: ${err.message}`)
      }
    }
    console.log(`✅ ${fkOk}/${FK_STATEMENTS.length} foreign keys aplicadas`)

    // Verify
    const afterTables = await client.query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = $1
      AND table_name IN ('RestaurantConfig', 'RestaurantZone', 'RestaurantTable', 'WaiterProfile', 'TableSession', 'TableOrder', 'TableOrderLine')
      ORDER BY table_name
    `, [TENANT_SCHEMA])
    console.log(`\n✅ Tablas de restaurante verificadas (${afterTables.rows.length}/7):`)
    afterTables.rows.forEach(r => console.log(`   ✅ ${r.table_name}`))

    if (afterTables.rows.length === 7) {
      console.log('\n🎉 TODAS las tablas de restaurante creadas exitosamente!')
    } else {
      console.error('\n⚠️ Faltan algunas tablas de restaurante!')
    }

  } catch (err: any) {
    console.error('❌ Error fatal:', err.message)
    process.exit(1)
  } finally {
    await client.end()
  }
}

main()
