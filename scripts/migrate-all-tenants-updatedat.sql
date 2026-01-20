-- ============================================
-- MIGRACIÓN MASIVA: Agregar updatedAt a Payment en TODOS los tenants
-- ============================================
-- 
-- ⚠️ IMPORTANTE: Este script SOLO funciona si todos los tenants
-- están en el MISMO proyecto de Supabase y usan el mismo esquema 'public'
-- 
-- Si cada tenant tiene su propia base de datos, usa el script TypeScript:
--   npx tsx scripts/migrate-all-tenants-updatedat.ts
--
-- ============================================

-- Opción 1: Si todos los tenants están en el mismo esquema 'public'
-- (Esto aplicaría la migración a todas las tablas Payment en el mismo esquema)
-- NOTA: Esto solo funciona si todos los tenants comparten la misma base de datos

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
        RAISE NOTICE '⚠️ Tabla Payment no existe en el esquema public';
        RAISE NOTICE '⚠️ Si cada tenant tiene su propia base de datos, usa el script TypeScript';
    END IF;
END $$;

-- Verificar que la columna fue creada
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default,
    '✅ Columna encontrada' as status
FROM information_schema.columns 
WHERE table_schema = 'public'
AND table_name = 'Payment' 
AND column_name = 'updatedAt';

-- ============================================
-- NOTA: Si cada tenant tiene su propia base de datos separada,
-- necesitas ejecutar este script en CADA base de datos de tenant.
-- 
-- Para automatizar esto, usa el script TypeScript:
--   npx tsx scripts/migrate-all-tenants-updatedat.ts
-- ============================================

