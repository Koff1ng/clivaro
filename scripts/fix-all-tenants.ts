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
