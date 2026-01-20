# Migración: Agregar columna `updatedAt` a la tabla `Payment`

## Problema
El modelo `Payment` en Prisma tiene definido `updatedAt DateTime @updatedAt`, pero la columna no existe en la base de datos, causando el error:
```
Invalid `prisma.payment.create()` invocation: The column `updatedAt` does not exist in the current database
```

## Solución
Ejecutar el siguiente SQL en el SQL Editor de Supabase:

```sql
-- Migración: Agregar columna updatedAt a Payment si no existe

-- Verificar si la columna ya existe antes de agregarla
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'Payment' 
        AND column_name = 'updatedAt'
    ) THEN
        ALTER TABLE "Payment" 
        ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
        
        -- Actualizar todos los registros existentes con la fecha de creación
        UPDATE "Payment" 
        SET "updatedAt" = "createdAt" 
        WHERE "updatedAt" IS NULL;
        
        RAISE NOTICE 'Columna updatedAt agregada a Payment';
    ELSE
        RAISE NOTICE 'Columna updatedAt ya existe en Payment';
    END IF;
END $$;

-- Verificar que la columna fue creada
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'Payment' 
AND column_name = 'updatedAt';
```

## Instrucciones
1. Abre el SQL Editor en Supabase
2. Copia y pega el SQL completo
3. Ejecuta la consulta
4. Verifica que la columna se creó correctamente

## Nota
Esta migración es idempotente: puedes ejecutarla múltiples veces sin problemas. Si la columna ya existe, simplemente mostrará un mensaje informativo.

