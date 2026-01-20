# Migración: Agregar columna `updatedAt` a la tabla `Payment`

## Problema
El modelo `Payment` en Prisma tiene definido `updatedAt DateTime @updatedAt`, pero la columna no existe en la base de datos, causando el error:
```
Invalid `prisma.payment.create()` invocation: The column `updatedAt` does not exist in the current database
```

## ⚠️ IMPORTANTE: Sistema Multi-Tenant

**Cada tenant tiene su propia base de datos.** Si ejecutaste la migración solo en la base de datos master, necesitas ejecutarla también en la base de datos del tenant que está experimentando el error.

### ¿Cómo identificar qué base de datos usar?

1. **Si el error ocurre desde el POS o cualquier operación del tenant:**
   - Necesitas ejecutar la migración en la **base de datos del tenant**
   - La URL de la base de datos del tenant está almacenada en `Tenant.databaseUrl` en la base de datos master

2. **Para encontrar la base de datos del tenant:**
   - Ve al Panel Admin → Tenants
   - Busca el tenant que está experimentando el error
   - Copia la `databaseUrl` de ese tenant
   - Conecta a esa base de datos en Supabase y ejecuta la migración

## Solución

Ejecutar el siguiente SQL en el SQL Editor de Supabase **en la base de datos correcta** (master o tenant según corresponda):

```sql
-- Migración: Agregar columna updatedAt a Payment si no existe
-- Esta migración es idempotente y segura de ejecutar múltiples veces

DO $$
BEGIN
    -- Verificar si la tabla Payment existe
    IF EXISTS (
        SELECT 1 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'Payment'
    ) THEN
        -- Verificar si la columna ya existe antes de agregarla
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
            
            -- Actualizar todos los registros existentes con la fecha de creación
            UPDATE "Payment" 
            SET "updatedAt" = "createdAt" 
            WHERE "updatedAt" IS NULL OR "updatedAt" < "createdAt";
            
            RAISE NOTICE '✅ Columna updatedAt agregada exitosamente a Payment';
        ELSE
            RAISE NOTICE 'ℹ️ Columna updatedAt ya existe en Payment';
        END IF;
    ELSE
        RAISE NOTICE '⚠️ Tabla Payment no existe en esta base de datos';
    END IF;
END $$;

-- Verificar que la columna fue creada correctamente
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_schema = 'public'
AND table_name = 'Payment' 
AND column_name = 'updatedAt';
```

## Instrucciones Paso a Paso

### Para la Base de Datos Master:
1. Abre el SQL Editor en Supabase
2. Asegúrate de estar conectado a la base de datos master (la que contiene las tablas `Tenant`, `Plan`, `Subscription`)
3. Copia y pega el SQL completo
4. Ejecuta la consulta
5. Verifica que la columna se creó correctamente

### Para la Base de Datos del Tenant:
1. **Identifica el tenant que está experimentando el error**
2. **Obtén la URL de la base de datos del tenant:**
   - Ve al Panel Admin → Tenants
   - Busca el tenant por nombre o slug
   - Copia la `databaseUrl` (ejemplo: `postgresql://...`)
3. **Conecta a esa base de datos en Supabase:**
   - Si todos los tenants están en el mismo proyecto de Supabase, cambia el esquema o la conexión
   - Si cada tenant tiene su propio proyecto, abre el SQL Editor de ese proyecto
4. **Ejecuta la migración SQL** en la base de datos del tenant
5. **Verifica** que la columna se creó correctamente

## Verificación

Después de ejecutar la migración, verifica que funcionó:

```sql
-- Verificar estructura de la tabla Payment
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_schema = 'public'
AND table_name = 'Payment'
ORDER BY ordinal_position;
```

Deberías ver `updatedAt` en la lista con:
- `data_type`: `timestamp without time zone`
- `is_nullable`: `NO`
- `column_default`: `CURRENT_TIMESTAMP`

## Nota
Esta migración es idempotente: puedes ejecutarla múltiples veces sin problemas. Si la columna ya existe, simplemente mostrará un mensaje informativo.

