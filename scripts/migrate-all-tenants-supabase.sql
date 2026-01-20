-- ============================================
-- MIGRACIÓN MASIVA: Agregar updatedAt a Payment
-- Para ejecutar directamente en Supabase SQL Editor
-- ============================================
--
-- ⚠️ IMPORTANTE: Este script SOLO funciona si todos los tenants
-- están en el MISMO proyecto de Supabase y comparten el esquema 'public'
--
-- Si cada tenant tiene su propia base de datos separada, necesitas:
-- 1. Ejecutar el script individual en cada base de datos de tenant
-- 2. O usar el script TypeScript desde un servidor con acceso a todas las BDs
--
-- ============================================

-- Paso 1: Verificar que la tabla Payment existe
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'Payment'
    ) THEN
        RAISE NOTICE '✅ Tabla Payment encontrada en esquema public';
        
        -- Paso 2: Verificar si la columna ya existe
        IF NOT EXISTS (
            SELECT 1 
            FROM information_schema.columns 
            WHERE table_schema = 'public'
            AND table_name = 'Payment' 
            AND column_name = 'updatedAt'
        ) THEN
            -- Paso 3: Agregar la columna con valor por defecto
            ALTER TABLE "Payment" 
            ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
            
            RAISE NOTICE '✅ Columna updatedAt agregada exitosamente';
            
            -- Paso 4: Actualizar todos los registros existentes con la fecha de creación
            UPDATE "Payment" 
            SET "updatedAt" = "createdAt" 
            WHERE "updatedAt" IS NULL OR "updatedAt" < "createdAt";
            
            RAISE NOTICE '✅ Registros existentes actualizados';
        ELSE
            RAISE NOTICE 'ℹ️ Columna updatedAt ya existe en Payment';
        END IF;
    ELSE
        RAISE NOTICE '⚠️ Tabla Payment no existe en el esquema public';
        RAISE NOTICE '⚠️ Si cada tenant tiene su propia base de datos, ejecuta el script individual en cada una';
    END IF;
END $$;

-- Paso 5: Verificar que la columna fue creada
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
-- CONSULTA ADICIONAL: Listar todos los tenants
-- (Para identificar qué bases de datos necesitan migración)
-- ============================================

-- Si quieres ver todos los tenants y sus URLs de base de datos:
-- SELECT 
--     id,
--     name,
--     slug,
--     active,
--     databaseUrl,
--     CASE 
--         WHEN databaseUrl LIKE 'postgresql://%' OR databaseUrl LIKE 'postgres://%' 
--         THEN 'PostgreSQL' 
--         ELSE 'SQLite' 
--     END as database_type
-- FROM "Tenant"
-- WHERE active = true
-- ORDER BY name;

