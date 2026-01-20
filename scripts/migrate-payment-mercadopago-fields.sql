-- ============================================
-- MIGRACIÓN: Agregar campos de Mercado Pago a la tabla Payment
-- ============================================
-- 
-- IMPORTANTE: Este script debe ejecutarse en la BASE DE DATOS DEL TENANT
-- (no en la base de datos master)
--
-- Estos campos son necesarios porque el schema de Prisma los define,
-- aunque el POS no los use directamente.
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
        RAISE NOTICE '✅ Tabla Payment encontrada';
        
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
            
            -- Crear índice único si no existe
            CREATE UNIQUE INDEX IF NOT EXISTS "Payment_mercadoPagoPaymentId_key" 
            ON "Payment"("mercadoPagoPaymentId") 
            WHERE "mercadoPagoPaymentId" IS NOT NULL;
            
            RAISE NOTICE '✅ Columna mercadoPagoPaymentId agregada';
        ELSE
            RAISE NOTICE 'ℹ️ Columna mercadoPagoPaymentId ya existe';
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
        ELSE
            RAISE NOTICE 'ℹ️ Columna mercadoPagoPreferenceId ya existe';
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
        ELSE
            RAISE NOTICE 'ℹ️ Columna mercadoPagoStatus ya existe';
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
        ELSE
            RAISE NOTICE 'ℹ️ Columna mercadoPagoStatusDetail ya existe';
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
        ELSE
            RAISE NOTICE 'ℹ️ Columna mercadoPagoPaymentMethod ya existe';
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
        ELSE
            RAISE NOTICE 'ℹ️ Columna mercadoPagoTransactionId ya existe';
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
        ELSE
            RAISE NOTICE 'ℹ️ Columna mercadoPagoResponse ya existe';
        END IF;
        
    ELSE
        RAISE NOTICE '⚠️ Tabla Payment no existe en esta base de datos';
        RAISE NOTICE '⚠️ Verifica que estás conectado a la base de datos correcta del tenant';
    END IF;
END $$;

-- Verificar que todas las columnas fueron creadas
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    CASE 
        WHEN column_name LIKE 'mercadoPago%' THEN '✅ Campo de Mercado Pago'
        ELSE 'Otro campo'
    END as tipo
FROM information_schema.columns 
WHERE table_schema = 'public'
AND table_name = 'Payment' 
AND column_name LIKE 'mercadoPago%'
ORDER BY column_name;

