/**
 * Script to apply Restaurant module tables to all tenant databases.
 * Creates: RestaurantConfig, RestaurantZone, RestaurantTable, WaiterProfile,
 *          TableSession, TableOrder, TableOrderLine
 * Also adds missing columns: tipAmount on Invoice, fields on Product, etc.
 *
 * Run with:
 *   npx tsx scripts/migrate-restaurant-tables.ts
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient({
    datasources: {
        db: { url: process.env.DATABASE_URL },
    },
})

const MIGRATION_SQL = `
DO $$
DECLARE
    v_schema text := current_schema();
BEGIN

    -- =====================================================
    -- 1. RestaurantConfig
    -- =====================================================
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = v_schema AND table_name = 'RestaurantConfig'
    ) THEN
        CREATE TABLE "RestaurantConfig" (
            "id"              TEXT NOT NULL,
            "tenantId"        TEXT NOT NULL,
            "isActive"        BOOLEAN NOT NULL DEFAULT true,
            "alegraEnabled"   BOOLEAN NOT NULL DEFAULT false,
            "alegraBusinessId" TEXT,
            "alegraEmail"     TEXT,
            "alegraToken"     TEXT,
            "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT "RestaurantConfig_pkey" PRIMARY KEY ("id")
        );
        CREATE UNIQUE INDEX "RestaurantConfig_tenantId_key" ON "RestaurantConfig"("tenantId");
        RAISE NOTICE '✅ Created RestaurantConfig';
    ELSE
        RAISE NOTICE 'ℹ️  RestaurantConfig already exists';
    END IF;

    -- =====================================================
    -- 2. RestaurantZone
    -- =====================================================
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = v_schema AND table_name = 'RestaurantZone'
    ) THEN
        CREATE TABLE "RestaurantZone" (
            "id"          TEXT NOT NULL,
            "tenantId"    TEXT NOT NULL,
            "name"        TEXT NOT NULL,
            "description" TEXT,
            "active"      BOOLEAN NOT NULL DEFAULT true,
            "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT "RestaurantZone_pkey" PRIMARY KEY ("id")
        );
        CREATE INDEX "RestaurantZone_tenantId_idx" ON "RestaurantZone"("tenantId");
        RAISE NOTICE '✅ Created RestaurantZone';
    ELSE
        RAISE NOTICE 'ℹ️  RestaurantZone already exists';
    END IF;

    -- =====================================================
    -- 3. RestaurantTable
    -- =====================================================
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = v_schema AND table_name = 'RestaurantTable'
    ) THEN
        CREATE TABLE "RestaurantTable" (
            "id"        TEXT NOT NULL,
            "tenantId"  TEXT NOT NULL,
            "zoneId"    TEXT NOT NULL,
            "name"      TEXT NOT NULL,
            "capacity"  INTEGER NOT NULL DEFAULT 2,
            "status"    TEXT NOT NULL DEFAULT 'AVAILABLE',
            "x"         INTEGER NOT NULL DEFAULT 0,
            "y"         INTEGER NOT NULL DEFAULT 0,
            "active"    BOOLEAN NOT NULL DEFAULT true,
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT "RestaurantTable_pkey" PRIMARY KEY ("id"),
            CONSTRAINT "RestaurantTable_zoneId_fkey" FOREIGN KEY ("zoneId")
                REFERENCES "RestaurantZone"("id") ON DELETE CASCADE ON UPDATE CASCADE
        );
        CREATE INDEX "RestaurantTable_tenantId_idx" ON "RestaurantTable"("tenantId");
        RAISE NOTICE '✅ Created RestaurantTable';
    ELSE
        RAISE NOTICE 'ℹ️  RestaurantTable already exists';
    END IF;

    -- =====================================================
    -- 4. WaiterProfile
    -- =====================================================
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = v_schema AND table_name = 'WaiterProfile'
    ) THEN
        CREATE TABLE "WaiterProfile" (
            "id"        TEXT NOT NULL,
            "tenantId"  TEXT NOT NULL,
            "name"      TEXT NOT NULL,
            "code"      TEXT NOT NULL,
            "pin"       TEXT NOT NULL,
            "active"    BOOLEAN NOT NULL DEFAULT true,
            "lastLogin" TIMESTAMP(3),
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT "WaiterProfile_pkey" PRIMARY KEY ("id")
        );
        CREATE UNIQUE INDEX "WaiterProfile_tenantId_code_key" ON "WaiterProfile"("tenantId", "code");
        CREATE UNIQUE INDEX "WaiterProfile_tenantId_pin_key"  ON "WaiterProfile"("tenantId", "pin");
        CREATE INDEX "WaiterProfile_tenantId_idx" ON "WaiterProfile"("tenantId");
        RAISE NOTICE '✅ Created WaiterProfile';
    ELSE
        -- Add pin unique index if it didn't exist yet (from previous partial migration)
        IF NOT EXISTS (
            SELECT 1 FROM pg_indexes
            WHERE schemaname = v_schema AND tablename = 'WaiterProfile' AND indexname = 'WaiterProfile_tenantId_pin_key'
        ) THEN
            CREATE UNIQUE INDEX "WaiterProfile_tenantId_pin_key" ON "WaiterProfile"("tenantId", "pin");
            RAISE NOTICE '✅ Added pin unique index to WaiterProfile';
        END IF;
        RAISE NOTICE 'ℹ️  WaiterProfile already exists';
    END IF;

    -- =====================================================
    -- 5. TableSession
    -- =====================================================
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = v_schema AND table_name = 'TableSession'
    ) THEN
        CREATE TABLE "TableSession" (
            "id"          TEXT NOT NULL,
            "tenantId"    TEXT NOT NULL,
            "tableId"     TEXT NOT NULL,
            "waiterId"    TEXT NOT NULL,
            "status"      TEXT NOT NULL DEFAULT 'OPEN',
            "openedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "closedAt"    TIMESTAMP(3),
            "totalAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
            "tipAmount"   DOUBLE PRECISION NOT NULL DEFAULT 0,
            "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT "TableSession_pkey" PRIMARY KEY ("id"),
            CONSTRAINT "TableSession_tableId_fkey" FOREIGN KEY ("tableId")
                REFERENCES "RestaurantTable"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
            CONSTRAINT "TableSession_waiterId_fkey" FOREIGN KEY ("waiterId")
                REFERENCES "WaiterProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE
        );
        CREATE INDEX "TableSession_tenantId_status_idx" ON "TableSession"("tenantId", "status");
        CREATE INDEX "TableSession_tableId_idx" ON "TableSession"("tableId");
        RAISE NOTICE '✅ Created TableSession';
    ELSE
        RAISE NOTICE 'ℹ️  TableSession already exists';
    END IF;

    -- =====================================================
    -- 6. TableOrder
    -- =====================================================
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = v_schema AND table_name = 'TableOrder'
    ) THEN
        CREATE TABLE "TableOrder" (
            "id"        TEXT NOT NULL,
            "tenantId"  TEXT NOT NULL,
            "sessionId" TEXT NOT NULL,
            "waiterId"  TEXT NOT NULL,
            "status"    TEXT NOT NULL DEFAULT 'PENDING',
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT "TableOrder_pkey" PRIMARY KEY ("id"),
            CONSTRAINT "TableOrder_sessionId_fkey" FOREIGN KEY ("sessionId")
                REFERENCES "TableSession"("id") ON DELETE CASCADE ON UPDATE CASCADE,
            CONSTRAINT "TableOrder_waiterId_fkey" FOREIGN KEY ("waiterId")
                REFERENCES "WaiterProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE
        );
        CREATE INDEX "TableOrder_sessionId_idx" ON "TableOrder"("sessionId");
        RAISE NOTICE '✅ Created TableOrder';
    ELSE
        RAISE NOTICE 'ℹ️  TableOrder already exists';
    END IF;

    -- =====================================================
    -- 7. TableOrderLine
    -- =====================================================
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = v_schema AND table_name = 'TableOrderLine'
    ) THEN
        CREATE TABLE "TableOrderLine" (
            "id"        TEXT NOT NULL,
            "orderId"   TEXT NOT NULL,
            "productId" TEXT NOT NULL,
            "variantId" TEXT,
            "quantity"  DOUBLE PRECISION NOT NULL,
            "unitPrice" DOUBLE PRECISION NOT NULL,
            "notes"     TEXT,
            "status"    TEXT NOT NULL DEFAULT 'PENDING',
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT "TableOrderLine_pkey" PRIMARY KEY ("id"),
            CONSTRAINT "TableOrderLine_orderId_fkey" FOREIGN KEY ("orderId")
                REFERENCES "TableOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE,
            CONSTRAINT "TableOrderLine_productId_fkey" FOREIGN KEY ("productId")
                REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE
        );
        CREATE INDEX "TableOrderLine_orderId_idx" ON "TableOrderLine"("orderId");
        RAISE NOTICE '✅ Created TableOrderLine';
    ELSE
        RAISE NOTICE 'ℹ️  TableOrderLine already exists';
    END IF;

    -- =====================================================
    -- 8. Product — printerStation column
    -- =====================================================
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = v_schema AND table_name = 'Product' AND column_name = 'printerStation'
    ) THEN
        ALTER TABLE "Product" ADD COLUMN "printerStation" TEXT;
        RAISE NOTICE '✅ Added printerStation to Product';
    END IF;

    -- =====================================================
    -- 9. Invoice — tipAmount column
    -- =====================================================
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = v_schema AND table_name = 'Invoice' AND column_name = 'tipAmount'
    ) THEN
        ALTER TABLE "Invoice" ADD COLUMN "tipAmount" DOUBLE PRECISION NOT NULL DEFAULT 0;
        RAISE NOTICE '✅ Added tipAmount to Invoice';
    END IF;

END $$;
`

async function migrateTenantDatabase(databaseUrl: string, tenantName: string, schemaName: string) {
    console.log(`\n🔄 Procesando tenant: ${tenantName} (schema: ${schemaName})`)

    const tenantPrisma = new PrismaClient({
        datasources: {
            db: { url: databaseUrl },
        },
        log: ['error'],
    })

    try {
        await tenantPrisma.$executeRawUnsafe(`SET search_path TO "${schemaName}"`)
        await tenantPrisma.$executeRawUnsafe(MIGRATION_SQL)
        console.log(`   ✅ Migración exitosa para ${tenantName}`)
    } catch (error: any) {
        console.error(`   ❌ Error en ${tenantName}:`, error.message)
    } finally {
        await tenantPrisma.$disconnect()
    }
}

function getSchemaName(tenantId: string): string {
    return `tenant_${tenantId.replace(/-/g, '')}`
}

async function main() {
    console.log('🚀 Iniciando migración de tablas de Restaurante en todos los tenants...\n')

    try {
        await prisma.$connect()
        console.log('✅ Conectado a la base de datos master\n')
    } catch (error: any) {
        console.error('❌ Error conectando a la BD master:', error.message)
        process.exit(1)
    }

    try {
        const tenants = await prisma.tenant.findMany({
            where: { active: true },
            select: { id: true, name: true, slug: true, databaseUrl: true },
        })

        const pgTenants = tenants.filter(
            (t) => t.databaseUrl && (t.databaseUrl.startsWith('postgresql://') || t.databaseUrl.startsWith('postgres://'))
        )

        if (pgTenants.length === 0) {
            console.log('⚠️  No se encontraron tenants PostgreSQL activos.')
            return
        }

        console.log(`📊 Se encontraron ${pgTenants.length} tenant(s) PostgreSQL\n`)

        let success = 0
        let errors = 0

        for (const tenant of pgTenants) {
            const schemaName = getSchemaName(tenant.id)

            // Build URL with the specific schema
            const urlObj = new URL(tenant.databaseUrl!)
            urlObj.searchParams.set('schema', schemaName)
            const schemaUrl = urlObj.toString()

            try {
                await migrateTenantDatabase(schemaUrl, tenant.name, schemaName)
                success++
            } catch {
                errors++
            }
        }

        console.log('\n' + '='.repeat(60))
        console.log('📊 Resumen de Migración:')
        console.log(`   ✅ Exitosos: ${success}`)
        console.log(`   ❌ Errores:  ${errors}`)
        console.log(`   📦 Total:   ${pgTenants.length}`)
        console.log('='.repeat(60))
    } catch (error: any) {
        console.error('❌ Error fatal:', error)
        process.exit(1)
    } finally {
        await prisma.$disconnect()
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error)
        process.exit(1)
    })
