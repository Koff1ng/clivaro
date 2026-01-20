-- ============================================
-- MIGRACIÓN: Agregar columna updatedAt a Payment
-- ============================================
-- 
-- IMPORTANTE: Este script debe ejecutarse en la BASE DE DATOS DEL TENANT
-- (no en la base de datos master)
--
-- Para identificar qué base de datos usar:
-- 1. Ve al Panel Admin → Tenants
-- 2. Busca el tenant que está experimentando el error
-- 3. Copia la databaseUrl de ese tenant
-- 4. Conecta a esa base de datos en Supabase
-- 5. Ejecuta este script
--
-- ============================================

-- Verificar si la tabla Payment existe
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
        
        -- Verificar si la columna ya existe
        IF NOT EXISTS (
            SELECT 1 
            FROM information_schema.columns 
            WHERE table_schema = 'public'
            AND table_name = 'Payment' 
            AND column_name = 'updatedAt'
        ) THEN
            -- Agregar la columna con valor por defecto
            ALTER TABLE "Payment" 
            ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
            
            RAISE NOTICE '✅ Columna updatedAt agregada exitosamente';
            
            -- Actualizar todos los registros existentes con la fecha de creación
            UPDATE "Payment" 
            SET "updatedAt" = "createdAt" 
            WHERE "updatedAt" IS NULL OR "updatedAt" < "createdAt";
            
            RAISE NOTICE '✅ Registros existentes actualizados';
        ELSE
            RAISE NOTICE 'ℹ️ Columna updatedAt ya existe en Payment';
        END IF;
    ELSE
        RAISE NOTICE '⚠️ Tabla Payment no existe en esta base de datos';
        RAISE NOTICE '⚠️ Verifica que estás conectado a la base de datos correcta del tenant';
    END IF;
END $$;

-- Verificar que la columna fue creada correctamente
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default,
    CASE 
        WHEN column_name = 'updatedAt' THEN '✅ Columna encontrada'
        ELSE '❌ Columna no encontrada'
    END as status
FROM information_schema.columns 
WHERE table_schema = 'public'
AND table_name = 'Payment' 
AND column_name = 'updatedAt';

-- Mostrar estructura completa de la tabla Payment para verificación
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_schema = 'public'
AND table_name = 'Payment'
ORDER BY ordinal_position;

