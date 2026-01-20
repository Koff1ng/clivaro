-- ============================================
-- MIGRACIÓN MASIVA: Agregar campos de Mercado Pago a Payment
-- Para ejecutar directamente en Supabase SQL Editor
-- ============================================
--
-- ⚠️ IMPORTANTE: Este script SOLO funciona si todos los tenants
-- están en el MISMO proyecto de Supabase y comparten el esquema 'public'
--
-- Si cada tenant tiene su propia base de datos separada, necesitas:
-- 1. Ejecutar el script individual (migrate-payment-mercadopago-fields.sql) en cada base de datos de tenant
-- 2. O usar el script TypeScript desde un servidor con acceso a todas las BDs
--
-- ============================================

DO $$
BEGIN
    -- Verificar si la tabla Payment existe
    IF EXISTS (
        SELECT 1 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'Payment'
    ) THEN
        RAISE NOTICE '✅ Tabla Payment encontrada en esquema public';
        
        -- Agregar mercadoPagoPaymentId si no existe
        IF NOT EXISTS (
            SELECT 1 
            FROM information_schema.columns 
            WHERE table_schema = 'public'
            AND table_name = 'Payment' 
            AND column_name = 'mercadoPagoPaymentId'
        ) THEN
            ALTER TABLE "Payment" 
            ADD COLUMN "mercadoPagoPaymentId" TEXT;
            
            CREATE UNIQUE INDEX IF NOT EXISTS "Payment_mercadoPagoPaymentId_key" 
            ON "Payment"("mercadoPagoPaymentId") 
            WHERE "mercadoPagoPaymentId" IS NOT NULL;
            
            RAISE NOTICE '✅ Columna mercadoPagoPaymentId agregada';
        END IF;
        
        -- Agregar mercadoPagoPreferenceId si no existe
        IF NOT EXISTS (
            SELECT 1 
            FROM information_schema.columns 
            WHERE table_schema = 'public'
            AND table_name = 'Payment' 
            AND column_name = 'mercadoPagoPreferenceId'
        ) THEN
            ALTER TABLE "Payment" 
            ADD COLUMN "mercadoPagoPreferenceId" TEXT;
            
            RAISE NOTICE '✅ Columna mercadoPagoPreferenceId agregada';
        END IF;
        
        -- Agregar mercadoPagoStatus si no existe
        IF NOT EXISTS (
            SELECT 1 
            FROM information_schema.columns 
            WHERE table_schema = 'public'
            AND table_name = 'Payment' 
            AND column_name = 'mercadoPagoStatus'
        ) THEN
            ALTER TABLE "Payment" 
            ADD COLUMN "mercadoPagoStatus" TEXT;
            
            RAISE NOTICE '✅ Columna mercadoPagoStatus agregada';
        END IF;
        
        -- Agregar mercadoPagoStatusDetail si no existe
        IF NOT EXISTS (
            SELECT 1 
            FROM information_schema.columns 
            WHERE table_schema = 'public'
            AND table_name = 'Payment' 
            AND column_name = 'mercadoPagoStatusDetail'
        ) THEN
            ALTER TABLE "Payment" 
            ADD COLUMN "mercadoPagoStatusDetail" TEXT;
            
            RAISE NOTICE '✅ Columna mercadoPagoStatusDetail agregada';
        END IF;
        
        -- Agregar mercadoPagoPaymentMethod si no existe
        IF NOT EXISTS (
            SELECT 1 
            FROM information_schema.columns 
            WHERE table_schema = 'public'
            AND table_name = 'Payment' 
            AND column_name = 'mercadoPagoPaymentMethod'
        ) THEN
            ALTER TABLE "Payment" 
            ADD COLUMN "mercadoPagoPaymentMethod" TEXT;
            
            RAISE NOTICE '✅ Columna mercadoPagoPaymentMethod agregada';
        END IF;
        
        -- Agregar mercadoPagoTransactionId si no existe
        IF NOT EXISTS (
            SELECT 1 
            FROM information_schema.columns 
            WHERE table_schema = 'public'
            AND table_name = 'Payment' 
            AND column_name = 'mercadoPagoTransactionId'
        ) THEN
            ALTER TABLE "Payment" 
            ADD COLUMN "mercadoPagoTransactionId" TEXT;
            
            RAISE NOTICE '✅ Columna mercadoPagoTransactionId agregada';
        END IF;
        
        -- Agregar mercadoPagoResponse si no existe
        IF NOT EXISTS (
            SELECT 1 
            FROM information_schema.columns 
            WHERE table_schema = 'public'
            AND table_name = 'Payment' 
            AND column_name = 'mercadoPagoResponse'
        ) THEN
            ALTER TABLE "Payment" 
            ADD COLUMN "mercadoPagoResponse" TEXT;
            
            RAISE NOTICE '✅ Columna mercadoPagoResponse agregada';
        END IF;
        
        RAISE NOTICE '✅ Migración de campos de Mercado Pago completada';
    ELSE
        RAISE NOTICE '⚠️ Tabla Payment no existe en el esquema public';
        RAISE NOTICE '⚠️ Si cada tenant tiene su propia base de datos, ejecuta el script individual en cada una';
    END IF;
END $$;

-- Verificar que todas las columnas fueron creadas
SELECT 
    column_name, 
    data_type, 
    is_nullable
FROM information_schema.columns 
WHERE table_schema = 'public'
AND table_name = 'Payment' 
AND column_name LIKE 'mercadoPago%'
ORDER BY column_name;

