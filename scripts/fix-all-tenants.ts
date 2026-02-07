import { prisma as masterPrisma } from '../lib/db'
import { getTenantPrisma } from '../lib/tenant-db'

async function main() {
    const masterUrl = process.env.DATABASE_URL || ''
    console.log('🚀 Iniciando reparación de esquema para TODOS los tenants...')
    console.log(`📡 URL Maestra detectada: ${masterUrl.split('@')[1] || masterUrl} (Asegúrate de que sea la de PRODUCCIÓN)`)

    if (masterUrl.includes('file:') || masterUrl.includes('.db') || !masterUrl) {
        console.warn('⚠️  ADVERTENCIA: Pareces estar conectado a una base de datos LOCAL (SQLite).')
        console.warn('    Esto NO arreglará la producción. Debes configurar DATABASE_URL con la conexión de Supabase.')
    }

    // 1. Obtener todos los tenants activos
    const tenants = await masterPrisma.tenant.findMany({
        where: { active: true },
    })

    console.log(`📋 Se encontraron ${tenants.length} tenants activos en la BD Maestra.`)

    if (tenants.length === 0) {
        console.error('❌ No se encontraron tenants. Verifica tu conexión a la BD Maestra.')
        return
    }

    for (const tenant of tenants) {
        console.log(`\n🔧 Procesando tenant: ${tenant.name} (${tenant.slug})...`)

        try {
            // Obtener cliente del tenant
            const tenantPrisma = getTenantPrisma(tenant.databaseUrl)

            // Ejecutar correcciones
            console.log('  - Conectando a BD...')

            // 1. Lead: instagram & updatedAt
            await tenantPrisma.$executeRawUnsafe(`ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "instagram" TEXT;`)
            await tenantPrisma.$executeRawUnsafe(`ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;`)

            // 2. Payment: updatedAt & MercadoPago fields (CRITICO para POS)
            await tenantPrisma.$executeRawUnsafe(`ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;`)
            await tenantPrisma.$executeRawUnsafe(`ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "mercadoPagoPaymentId" TEXT;`)
            await tenantPrisma.$executeRawUnsafe(`ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "mercadoPagoPreferenceId" TEXT;`)
            await tenantPrisma.$executeRawUnsafe(`ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "mercadoPagoStatus" TEXT;`)
            await tenantPrisma.$executeRawUnsafe(`ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "mercadoPagoStatusDetail" TEXT;`)
            await tenantPrisma.$executeRawUnsafe(`ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "mercadoPagoPaymentMethod" TEXT;`)
            await tenantPrisma.$executeRawUnsafe(`ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "mercadoPagoTransactionId" TEXT;`)
            await tenantPrisma.$executeRawUnsafe(`ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "mercadoPagoResponse" TEXT;`)

            // Indices para Payment
            await tenantPrisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "Payment_mercadoPagoPaymentId_key" ON "Payment"("mercadoPagoPaymentId");`)
            await tenantPrisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "Payment_mercadoPagoPaymentId_idx" ON "Payment"("mercadoPagoPaymentId");`)
            await tenantPrisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "Payment_mercadoPagoPreferenceId_idx" ON "Payment"("mercadoPagoPreferenceId");`)

            // 2.1 Subscription: MercadoPago fields
            await tenantPrisma.$executeRawUnsafe(`ALTER TABLE "Subscription" ADD COLUMN IF NOT EXISTS "mercadoPagoPaymentId" TEXT;`)
            await tenantPrisma.$executeRawUnsafe(`ALTER TABLE "Subscription" ADD COLUMN IF NOT EXISTS "mercadoPagoPreferenceId" TEXT;`)
            await tenantPrisma.$executeRawUnsafe(`ALTER TABLE "Subscription" ADD COLUMN IF NOT EXISTS "mercadoPagoStatus" TEXT;`)

            // 3. User & Tenant: updatedAt
            await tenantPrisma.$executeRawUnsafe(`ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;`)
            await tenantPrisma.$executeRawUnsafe(`ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;`)

            // 3.1 Invoice: Electronic Billing fields
            await tenantPrisma.$executeRawUnsafe(`ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "cufe" TEXT;`)
            await tenantPrisma.$executeRawUnsafe(`ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "qrCode" TEXT;`)
            await tenantPrisma.$executeRawUnsafe(`ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "electronicStatus" TEXT;`)
            await tenantPrisma.$executeRawUnsafe(`ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "electronicSentAt" TIMESTAMP(3);`)
            await tenantPrisma.$executeRawUnsafe(`ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "electronicResponse" TEXT;`)
            await tenantPrisma.$executeRawUnsafe(`ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "resolutionNumber" TEXT;`)
            await tenantPrisma.$executeRawUnsafe(`ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "alegraInvoiceId" TEXT;`)

            // Unique index for cufe
            await tenantPrisma.$executeRawUnsafe(`
                DO $$ BEGIN
                    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'Invoice_cufe_key') THEN
                        CREATE UNIQUE INDEX "Invoice_cufe_key" ON "Invoice"("cufe") WHERE "cufe" IS NOT NULL;
                    END IF;
                END $$;
            `)

            // 3.2 CreditNote Tables
            console.log('  - Creando tablas de Notas Crédito...')
            await tenantPrisma.$executeRawUnsafe(`
                CREATE TABLE IF NOT EXISTS "CreditNote" (
                    "id" TEXT NOT NULL,
                    "number" TEXT NOT NULL,
                    "prefix" TEXT,
                    "consecutive" TEXT,
                    "invoiceId" TEXT NOT NULL,
                    "returnId" TEXT,
                    "type" TEXT NOT NULL,
                    "referenceCode" TEXT NOT NULL,
                    "affectedPeriod" TEXT,
                    "subtotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
                    "discount" DOUBLE PRECISION NOT NULL DEFAULT 0,
                    "tax" DOUBLE PRECISION NOT NULL DEFAULT 0,
                    "total" DOUBLE PRECISION NOT NULL DEFAULT 0,
                    "cufe" TEXT,
                    "qrCode" TEXT,
                    "electronicStatus" TEXT,
                    "electronicSentAt" TIMESTAMP(3),
                    "electronicResponse" TEXT,
                    "resolutionNumber" TEXT,
                    "reason" TEXT NOT NULL,
                    "notes" TEXT,
                    "status" TEXT NOT NULL DEFAULT 'PENDING',
                    "issuedAt" TIMESTAMP(3),
                    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    "updatedAt" TIMESTAMP(3) NOT NULL,
                    "createdById" TEXT,
                    "alegraId" TEXT,
                    CONSTRAINT "CreditNote_pkey" PRIMARY KEY ("id")
                );
            `)

            await tenantPrisma.$executeRawUnsafe(`
                CREATE TABLE IF NOT EXISTS "CreditNoteItem" (
                    "id" TEXT NOT NULL,
                    "creditNoteId" TEXT NOT NULL,
                    "invoiceItemId" TEXT,
                    "productId" TEXT NOT NULL,
                    "variantId" TEXT,
                    "description" TEXT NOT NULL,
                    "quantity" DOUBLE PRECISION NOT NULL,
                    "unitPrice" DOUBLE PRECISION NOT NULL,
                    "discount" DOUBLE PRECISION NOT NULL DEFAULT 0,
                    "taxRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
                    "subtotal" DOUBLE PRECISION NOT NULL,
                    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    CONSTRAINT "CreditNoteItem_pkey" PRIMARY KEY ("id")
                );
            `)

            await tenantPrisma.$executeRawUnsafe(`
                CREATE TABLE IF NOT EXISTS "CreditNoteLineTax" (
                    "id" TEXT NOT NULL,
                    "creditNoteItemId" TEXT NOT NULL,
                    "taxRateId" TEXT,
                    "baseAmount" DOUBLE PRECISION NOT NULL,
                    "taxAmount" DOUBLE PRECISION NOT NULL,
                    "taxPercentage" DOUBLE PRECISION NOT NULL,
                    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    CONSTRAINT "CreditNoteLineTax_pkey" PRIMARY KEY ("id")
                );
            `)

            await tenantPrisma.$executeRawUnsafe(`
                CREATE TABLE IF NOT EXISTS "CreditNoteTaxSummary" (
                    "id" TEXT NOT NULL,
                    "creditNoteId" TEXT NOT NULL,
                    "taxRateId" TEXT NOT NULL,
                    "taxableAmount" DOUBLE PRECISION NOT NULL,
                    "taxAmount" DOUBLE PRECISION NOT NULL,
                    "taxPercentage" DOUBLE PRECISION NOT NULL,
                    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    CONSTRAINT "CreditNoteTaxSummary_pkey" PRIMARY KEY ("id")
                );
            `)

            await tenantPrisma.$executeRawUnsafe(`
                CREATE TABLE IF NOT EXISTS "CreditNoteTransmission" (
                    "id" TEXT NOT NULL,
                    "creditNoteId" TEXT NOT NULL,
                    "provider" TEXT NOT NULL,
                    "externalId" TEXT,
                    "status" TEXT NOT NULL DEFAULT 'PENDING',
                    "xmlGenerated" BOOLEAN NOT NULL DEFAULT false,
                    "xmlContent" TEXT,
                    "transmittedAt" TIMESTAMP(3),
                    "responseData" TEXT,
                    "errorMessage" TEXT,
                    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    "updatedAt" TIMESTAMP(3) NOT NULL,
                    CONSTRAINT "CreditNoteTransmission_pkey" PRIMARY KEY ("id")
                );
            `)

            await tenantPrisma.$executeRawUnsafe(`
                CREATE TABLE IF NOT EXISTS "CreditNoteEvent" (
                    "id" TEXT NOT NULL,
                    "transmissionId" TEXT NOT NULL,
                    "event" TEXT NOT NULL,
                    "message" TEXT,
                    "data" TEXT,
                    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    CONSTRAINT "CreditNoteEvent_pkey" PRIMARY KEY ("id")
                );
            `)

            // Índices y FKs para Notas Crédito
            await tenantPrisma.$executeRawUnsafe(`
                DO $$ BEGIN
                    -- CreditNote indices
                    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'CreditNote_number_key') THEN
                        CREATE UNIQUE INDEX "CreditNote_number_key" ON "CreditNote"("number");
                    END IF;
                    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'CreditNote_returnId_key') THEN
                        CREATE UNIQUE INDEX "CreditNote_returnId_key" ON "CreditNote"("returnId");
                    END IF;
                    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'CreditNote_cufe_key') THEN
                        CREATE UNIQUE INDEX "CreditNote_cufe_key" ON "CreditNote"("cufe");
                    END IF;

                    -- CreditNote FKs
                    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'CreditNote_invoiceId_fkey') THEN
                        ALTER TABLE "CreditNote" ADD CONSTRAINT "CreditNote_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
                    END IF;
                    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'CreditNote_returnId_fkey') THEN
                        ALTER TABLE "CreditNote" ADD CONSTRAINT "CreditNote_returnId_fkey" FOREIGN KEY ("returnId") REFERENCES "Return"("id") ON DELETE SET NULL ON UPDATE CASCADE;
                    END IF;

                    -- CreditNoteItem FKs
                    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'CreditNoteItem_creditNoteId_fkey') THEN
                        ALTER TABLE "CreditNoteItem" ADD CONSTRAINT "CreditNoteItem_creditNoteId_fkey" FOREIGN KEY ("creditNoteId") REFERENCES "CreditNote"("id") ON DELETE CASCADE ON UPDATE CASCADE;
                    END IF;
                    
                    -- CreditNoteLineTax FKs
                    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'CreditNoteLineTax_creditNoteItemId_fkey') THEN
                        ALTER TABLE "CreditNoteLineTax" ADD CONSTRAINT "CreditNoteLineTax_creditNoteItemId_fkey" FOREIGN KEY ("creditNoteItemId") REFERENCES "CreditNoteItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
                    END IF;

                    -- CreditNoteTaxSummary FKs
                    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'CreditNoteTaxSummary_creditNoteId_fkey') THEN
                        ALTER TABLE "CreditNoteTaxSummary" ADD CONSTRAINT "CreditNoteTaxSummary_creditNoteId_fkey" FOREIGN KEY ("creditNoteId") REFERENCES "CreditNote"("id") ON DELETE CASCADE ON UPDATE CASCADE;
                    END IF;

                    -- CreditNoteTransmission FKs
                    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'CreditNoteTransmission_creditNoteId_fkey') THEN
                        ALTER TABLE "CreditNoteTransmission" ADD CONSTRAINT "CreditNoteTransmission_creditNoteId_fkey" FOREIGN KEY ("creditNoteId") REFERENCES "CreditNote"("id") ON DELETE CASCADE ON UPDATE CASCADE;
                    END IF;
                    
                    -- CreditNoteEvent FKs
                    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'CreditNoteEvent_transmissionId_fkey') THEN
                        ALTER TABLE "CreditNoteEvent" ADD CONSTRAINT "CreditNoteEvent_transmissionId_fkey" FOREIGN KEY ("transmissionId") REFERENCES "CreditNoteTransmission"("id") ON DELETE CASCADE ON UPDATE CASCADE;
                    END IF;

                    -- Unique index para CreditNoteTransmission
                    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'CreditNoteTransmission_creditNoteId_key') THEN
                        CREATE UNIQUE INDEX "CreditNoteTransmission_creditNoteId_key" ON "CreditNoteTransmission"("creditNoteId");
                    END IF;
                END $$;
            `)

            // 4. TenantSettings: Meta fields
            await tenantPrisma.$executeRawUnsafe(`ALTER TABLE "TenantSettings" ADD COLUMN IF NOT EXISTS "metaBusinessId" TEXT;`)
            await tenantPrisma.$executeRawUnsafe(`ALTER TABLE "TenantSettings" ADD COLUMN IF NOT EXISTS "metaAccessToken" TEXT;`)
            await tenantPrisma.$executeRawUnsafe(`ALTER TABLE "TenantSettings" ADD COLUMN IF NOT EXISTS "whatsappPhoneNumberId" TEXT;`)
            await tenantPrisma.$executeRawUnsafe(`ALTER TABLE "TenantSettings" ADD COLUMN IF NOT EXISTS "instagramAccountId" TEXT;`)

            // 5. ChatMessage table
            await tenantPrisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "ChatMessage" (
            "id" TEXT NOT NULL,
            "leadId" TEXT NOT NULL,
            "direction" TEXT NOT NULL,
            "channel" TEXT NOT NULL,
            "type" TEXT NOT NULL DEFAULT 'text',
            "content" TEXT NOT NULL,
            "mediaUrl" TEXT,
            "externalId" TEXT,
            "status" TEXT NOT NULL DEFAULT 'SENT',
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        
            CONSTRAINT "ChatMessage_pkey" PRIMARY KEY ("id")
        );
      `)

            // Indices para ChatMessage (usando bloque DO para IF NOT EXISTS en indices)
            await tenantPrisma.$executeRawUnsafe(`
        DO $$ 
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'ChatMessage_externalId_key') THEN
                CREATE UNIQUE INDEX "ChatMessage_externalId_key" ON "ChatMessage"("externalId");
            END IF;
            
            IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'ChatMessage_leadId_idx') THEN
                CREATE INDEX "ChatMessage_leadId_idx" ON "ChatMessage"("leadId");
            END IF;
        END $$;
      `)

            // FK para ChatMessage
            await tenantPrisma.$executeRawUnsafe(`
        DO $$ 
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'ChatMessage_leadId_fkey') THEN
                ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;
            END IF;
        END $$;
      `)

            // 6. Electronic Invoicing Tables
            console.log('  - Creando tablas de facturación electrónica...')

            // ElectronicInvoiceTransmission
            await tenantPrisma.$executeRawUnsafe(`
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
            await tenantPrisma.$executeRawUnsafe(`
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

            // Indices y FKs para Facturación Electrónica
            await tenantPrisma.$executeRawUnsafe(`
                DO $$ BEGIN
                    -- Unique index para transmission
                    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'ElectronicInvoiceTransmission_tenantId_invoiceId_key') THEN
                        CREATE UNIQUE INDEX "ElectronicInvoiceTransmission_tenantId_invoiceId_key" ON "ElectronicInvoiceTransmission"("tenantId", "invoiceId");
                    END IF;

                    -- Indices para transmission
                    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'ElectronicInvoiceTransmission_tenantId_status_idx') THEN
                        CREATE INDEX "ElectronicInvoiceTransmission_tenantId_status_idx" ON "ElectronicInvoiceTransmission"("tenantId", "status");
                    END IF;
                    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'ElectronicInvoiceTransmission_tenantId_createdAt_idx') THEN
                        CREATE INDEX "ElectronicInvoiceTransmission_tenantId_createdAt_idx" ON "ElectronicInvoiceTransmission"("tenantId", "createdAt");
                    END IF;

                    -- Indices para event
                    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'ElectronicInvoiceEvent_transmissionId_createdAt_idx') THEN
                        CREATE INDEX "ElectronicInvoiceEvent_transmissionId_createdAt_idx" ON "ElectronicInvoiceEvent"("transmissionId", "createdAt");
                    END IF;

                    -- FKs
                    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'ElectronicInvoiceTransmission_invoiceId_fkey') THEN
                        ALTER TABLE "ElectronicInvoiceTransmission" ADD CONSTRAINT "ElectronicInvoiceTransmission_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
                    END IF;
                    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'ElectronicInvoiceEvent_transmissionId_fkey') THEN
                        ALTER TABLE "ElectronicInvoiceEvent" ADD CONSTRAINT "ElectronicInvoiceEvent_transmissionId_fkey" FOREIGN KEY ("transmissionId") REFERENCES "ElectronicInvoiceTransmission"("id") ON DELETE CASCADE ON UPDATE CASCADE;
                    END IF;
                END $$;
            `)

            console.log('  ✅ Esquema actualizado correctamente.')

        } catch (error: any) {
            console.error(`  ❌ Error actualizando tenant ${tenant.slug}:`, error.message)
        }
    }

    console.log('\n🏁 Proceso completado.')
}

main()
    .catch((e) => {
        console.error('FATAL ERROR:', e)
        if (e.message) console.error('Message:', e.message)
        if (e.code) console.error('Code:', e.code)
        if (e.meta) console.error('Meta:', e.meta)
        process.exit(1)
    })
    .finally(async () => {
        await masterPrisma.$disconnect()
    })
