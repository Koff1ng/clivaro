import { prisma as masterPrisma } from '../lib/db'

async function main() {
    console.log('🚀 Iniciando reparación de esquema para la BD MAESTRA...')

    try {
        // ElectronicInvoiceProviderConfig
        await masterPrisma.$executeRawUnsafe(`
            CREATE TABLE IF NOT EXISTS "ElectronicInvoiceProviderConfig" (
                "id" TEXT NOT NULL,
                "tenantId" TEXT NOT NULL,
                "provider" TEXT NOT NULL DEFAULT 'ALEGRA',
                "alegraEmail" TEXT NOT NULL,
                "alegraTokenEncrypted" TEXT NOT NULL,
                "status" TEXT NOT NULL DEFAULT 'disconnected',
                "lastCheckedAt" TIMESTAMP(3),
                "companyInfo" JSONB,
                "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
                "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

                CONSTRAINT "ElectronicInvoiceProviderConfig_pkey" PRIMARY KEY ("id")
            );
        `)

        await masterPrisma.$executeRawUnsafe(`
            DO $$ BEGIN
                IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'ElectronicInvoiceProviderConfig_tenantId_provider_key') THEN
                    CREATE UNIQUE INDEX "ElectronicInvoiceProviderConfig_tenantId_provider_key" ON "ElectronicInvoiceProviderConfig"("tenantId", "provider");
                END IF;
            END $$;
        `)

        // ElectronicInvoiceTransmission
        await masterPrisma.$executeRawUnsafe(`
            CREATE TABLE IF NOT EXISTS "ElectronicInvoiceTransmission" (
                "id" TEXT NOT NULL,
                "tenantId" TEXT NOT NULL,
                "invoiceId" TEXT NOT NULL,
                "provider" TEXT NOT NULL DEFAULT 'ALEGRA',
                "status" TEXT NOT NULL DEFAULT 'QUEUED',
                "attemptCount" INTEGER NOT NULL DEFAULT 0,
                "lastAttemptAt" TIMESTAMP(3),
                "alegraInvoiceId" TEXT,
                "lastErrorMessage" TEXT,
                "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
                "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

                CONSTRAINT "ElectronicInvoiceTransmission_pkey" PRIMARY KEY ("id")
            );
        `)

        // ElectronicInvoiceEvent
        await masterPrisma.$executeRawUnsafe(`
            CREATE TABLE IF NOT EXISTS "ElectronicInvoiceEvent" (
                "id" TEXT NOT NULL,
                "tenantId" TEXT NOT NULL,
                "transmissionId" TEXT NOT NULL,
                "eventType" TEXT NOT NULL,
                "payloadSanitized" JSONB,
                "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

                CONSTRAINT "ElectronicInvoiceEvent_pkey" PRIMARY KEY ("id")
            );
        `)

        // Indices
        await masterPrisma.$executeRawUnsafe(`
            DO $$ BEGIN
                IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'ElectronicInvoiceTransmission_tenantId_invoiceId_key') THEN
                    CREATE UNIQUE INDEX "ElectronicInvoiceTransmission_tenantId_invoiceId_key" ON "ElectronicInvoiceTransmission"("tenantId", "invoiceId");
                END IF;
                IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'ElectronicInvoiceTransmission_tenantId_status_idx') THEN
                    CREATE INDEX "ElectronicInvoiceTransmission_tenantId_status_idx" ON "ElectronicInvoiceTransmission"("tenantId", "status");
                END IF;
                IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'ElectronicInvoiceTransmission_tenantId_createdAt_idx') THEN
                    CREATE INDEX "ElectronicInvoiceTransmission_tenantId_createdAt_idx" ON "ElectronicInvoiceTransmission"("tenantId", "createdAt");
                END IF;
                IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'ElectronicInvoiceEvent_transmissionId_createdAt_idx') THEN
                    CREATE INDEX "ElectronicInvoiceEvent_transmissionId_createdAt_idx" ON "ElectronicInvoiceEvent"("transmissionId", "createdAt");
                END IF;
            END $$;
        `)

        console.log('✅ BD MAESTRA actualizada correctamente.')
    } catch (error: any) {
        console.error('❌ Error actualizando BD MAESTRA:', error.message)
    } finally {
        await masterPrisma.$disconnect()
    }
}

main()
