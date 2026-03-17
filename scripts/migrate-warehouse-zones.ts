/**
 * Script to apply WarehouseZone and zoneId migrations to all tenant databases
 * 
 * Run with:
 *   npx tsx scripts/migrate-warehouse-zones.ts
 */

import { PrismaClient } from '@prisma/client'
import { PrismaClient as TenantPrismaClient } from '@prisma/client'

const prisma = new PrismaClient({
    datasources: {
        db: {
            url: process.env.DATABASE_URL,
        },
    },
})

const MIGRATION_SQL = `
DO $$
DECLARE
    v_schema text := current_schema();
BEGIN
    -- 1. Create WarehouseZone table
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables WHERE table_schema = v_schema AND table_name = 'WarehouseZone'
    ) THEN
        CREATE TABLE "WarehouseZone" (
            "id" TEXT NOT NULL,
            "name" TEXT NOT NULL,
            "description" TEXT,
            "warehouseId" TEXT NOT NULL,
            "active" BOOLEAN NOT NULL DEFAULT true,
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" TIMESTAMP(3) NOT NULL,
            CONSTRAINT "WarehouseZone_pkey" PRIMARY KEY ("id")
        );
        CREATE INDEX "WarehouseZone_warehouseId_idx" ON "WarehouseZone"("warehouseId");
        CREATE UNIQUE INDEX "WarehouseZone_warehouseId_name_key" ON "WarehouseZone"("warehouseId", "name");
        ALTER TABLE "WarehouseZone" ADD CONSTRAINT "WarehouseZone_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE CASCADE ON UPDATE CASCADE;
        RAISE NOTICE '✅ Created WarehouseZone table';
    ELSE
        RAISE NOTICE 'ℹ️ WarehouseZone table already exists';
    END IF;

    -- 2. Add preferredZoneId to Product
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = v_schema AND table_name = 'Product') THEN
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns WHERE table_schema = v_schema AND table_name = 'Product' AND column_name = 'preferredZoneId'
        ) THEN
            ALTER TABLE "Product" ADD COLUMN "preferredZoneId" TEXT;
            ALTER TABLE "Product" ADD CONSTRAINT "Product_preferredZoneId_fkey" FOREIGN KEY ("preferredZoneId") REFERENCES "WarehouseZone"("id") ON DELETE SET NULL ON UPDATE CASCADE;
            RAISE NOTICE '✅ Added preferredZoneId to Product';
        END IF;
    END IF;

    -- 3. Add zoneId to StockLevel
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = v_schema AND table_name = 'StockLevel') THEN
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns WHERE table_schema = v_schema AND table_name = 'StockLevel' AND column_name = 'zoneId'
        ) THEN
            ALTER TABLE "StockLevel" ADD COLUMN "zoneId" TEXT;
            ALTER TABLE "StockLevel" ADD CONSTRAINT "StockLevel_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "WarehouseZone"("id") ON DELETE SET NULL ON UPDATE CASCADE;
            CREATE INDEX "StockLevel_zoneId_idx" ON "StockLevel"("zoneId");
            
            -- Recreate unique constraints if old ones exist, to include zoneId (NULL allowed)
            DROP INDEX IF EXISTS "StockLevel_warehouseId_productId_variantId_key";
            CREATE UNIQUE INDEX "StockLevel_warehouseId_zoneId_productId_variantId_key" ON "StockLevel"("warehouseId", "zoneId", "productId", "variantId");
            
            RAISE NOTICE '✅ Added zoneId to StockLevel';
        END IF;
    END IF;

    -- 4. Add zoneId to StockMovement
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = v_schema AND table_name = 'StockMovement') THEN
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns WHERE table_schema = v_schema AND table_name = 'StockMovement' AND column_name = 'zoneId'
        ) THEN
            ALTER TABLE "StockMovement" ADD COLUMN "zoneId" TEXT;
            ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "WarehouseZone"("id") ON DELETE SET NULL ON UPDATE CASCADE;
            CREATE INDEX "StockMovement_zoneId_idx" ON "StockMovement"("zoneId");
            RAISE NOTICE '✅ Added zoneId to StockMovement';
        END IF;
    END IF;

    -- 5. Add zoneId to PhysicalInventoryItem
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = v_schema AND table_name = 'PhysicalInventoryItem') THEN
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns WHERE table_schema = v_schema AND table_name = 'PhysicalInventoryItem' AND column_name = 'zoneId'
        ) THEN
            ALTER TABLE "PhysicalInventoryItem" ADD COLUMN "zoneId" TEXT;
            ALTER TABLE "PhysicalInventoryItem" ADD CONSTRAINT "PhysicalInventoryItem_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "WarehouseZone"("id") ON DELETE SET NULL ON UPDATE CASCADE;
            CREATE INDEX "PhysicalInventoryItem_zoneId_idx" ON "PhysicalInventoryItem"("zoneId");
            RAISE NOTICE '✅ Added zoneId to PhysicalInventoryItem';
        END IF;
    END IF;

    -- 6. Add zoneId to QuotationItem
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = v_schema AND table_name = 'QuotationItem') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = v_schema AND table_name = 'QuotationItem' AND column_name = 'zoneId') THEN
            ALTER TABLE "QuotationItem" ADD COLUMN "zoneId" TEXT;
            RAISE NOTICE '✅ Added zoneId to QuotationItem';
        END IF;
    END IF;

    -- 7. Add zoneId to SalesOrderItem
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = v_schema AND table_name = 'SalesOrderItem') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = v_schema AND table_name = 'SalesOrderItem' AND column_name = 'zoneId') THEN
            ALTER TABLE "SalesOrderItem" ADD COLUMN "zoneId" TEXT;
            RAISE NOTICE '✅ Added zoneId to SalesOrderItem';
        END IF;
    END IF;

    -- 8. Add zoneId to InvoiceItem
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = v_schema AND table_name = 'InvoiceItem') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = v_schema AND table_name = 'InvoiceItem' AND column_name = 'zoneId') THEN
            ALTER TABLE "InvoiceItem" ADD COLUMN "zoneId" TEXT;
            RAISE NOTICE '✅ Added zoneId to InvoiceItem';
        END IF;
    END IF;

    -- 9. Add zoneId to PurchaseOrderItem
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = v_schema AND table_name = 'PurchaseOrderItem') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = v_schema AND table_name = 'PurchaseOrderItem' AND column_name = 'zoneId') THEN
            ALTER TABLE "PurchaseOrderItem" ADD COLUMN "zoneId" TEXT;
            RAISE NOTICE '✅ Added zoneId to PurchaseOrderItem';
        END IF;
    END IF;

    -- 10. Add zoneId to GoodsReceiptItem
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = v_schema AND table_name = 'GoodsReceiptItem') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = v_schema AND table_name = 'GoodsReceiptItem' AND column_name = 'zoneId') THEN
            ALTER TABLE "GoodsReceiptItem" ADD COLUMN "zoneId" TEXT;
            RAISE NOTICE '✅ Added zoneId to GoodsReceiptItem';
        END IF;
    END IF;

    -- 11. Add zoneId to ReturnItem
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = v_schema AND table_name = 'ReturnItem') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = v_schema AND table_name = 'ReturnItem' AND column_name = 'zoneId') THEN
            ALTER TABLE "ReturnItem" ADD COLUMN "zoneId" TEXT;
            RAISE NOTICE '✅ Added zoneId to ReturnItem';
        END IF;
    END IF;

    -- 12. Add zoneId to CreditNoteItem
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = v_schema AND table_name = 'CreditNoteItem') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = v_schema AND table_name = 'CreditNoteItem' AND column_name = 'zoneId') THEN
            ALTER TABLE "CreditNoteItem" ADD COLUMN "zoneId" TEXT;
            RAISE NOTICE '✅ Added zoneId to CreditNoteItem';
        END IF;
    END IF;

END $$;
`

async function migrateTenantDatabase(databaseUrl: string, tenantName: string, tenantSlug: string) {
    console.log(`\n🔄 Processing tenant: ${tenantName} (${tenantSlug})`)

    try {
        const tenantPrisma = new TenantPrismaClient({
            datasources: {
                db: { url: databaseUrl },
            },
            log: ['error'], // suppress info logs for cleaner view
        })

        await tenantPrisma.$executeRawUnsafe(MIGRATION_SQL)
        console.log(`   ✅ Migration successfully executed for ${tenantName}`)

        await tenantPrisma.$disconnect()
    } catch (error: any) {
        console.error(`   ❌ Error in ${tenantName}:`, error.message)
    }
}

async function main() {
    console.log('🚀 Starting Warehouse Zones migration for all tenants...\n')

    try {
        await prisma.$connect()
        console.log('✅ Connected to master database\n')
    } catch (error: any) {
        console.error('❌ Error connecting to master DB:', error.message)
        process.exit(1)
    }

    try {
        const tenants = await prisma.tenant.findMany({
            where: { active: true },
            select: { id: true, name: true, slug: true, databaseUrl: true },
        })

        const postgresTenants = tenants.filter(
            (t) => t.databaseUrl && (t.databaseUrl.startsWith('postgresql://') || t.databaseUrl.startsWith('postgres://'))
        )

        if (postgresTenants.length === 0) {
            console.log('⚠️  No active PostgreSQL tenants found.')
            return
        }

        console.log(`📊 Found ${postgresTenants.length} PostgreSQL tenant(s)\n`)

        let successCount = 0
        let errorCount = 0

        for (const tenant of postgresTenants) {
            try {
                await migrateTenantDatabase(tenant.databaseUrl!, tenant.name, tenant.slug)
                successCount++
            } catch (error) {
                errorCount++
            }
        }

        console.log('\n' + '='.repeat(60))
        console.log('📊 Migration Summary:')
        console.log(`   ✅ Success: ${successCount}`)
        console.log(`   ❌ Errors: ${errorCount}`)
        console.log(`   📦 Total: ${postgresTenants.length}`)
        console.log('='.repeat(60))
    } catch (error: any) {
        console.error('❌ Fatal error:', error)
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
