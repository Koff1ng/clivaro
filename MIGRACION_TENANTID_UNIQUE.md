# Migración: Agregar UNIQUE constraint a tenantId en Subscription

## Problema
El modelo `Subscription` necesita que `tenantId` sea único para poder usar `upsert` con `where: { tenantId }`. Actualmente solo tiene un índice, no una constraint UNIQUE.

## Solución
Ejecutar el siguiente SQL en el **Supabase SQL Editor**:

```sql
-- Agregar constraint UNIQUE a tenantId en Subscription
-- Esto permite usar tenantId como clave única en upsert operations

-- Verificar si ya existe la constraint
DO $$
BEGIN
  -- Agregar constraint UNIQUE si no existe
  IF NOT EXISTS (
    SELECT 1 
    FROM pg_constraint 
    WHERE conname = 'Subscription_tenantId_key'
  ) THEN
    ALTER TABLE "Subscription" 
    ADD CONSTRAINT "Subscription_tenantId_key" UNIQUE ("tenantId");
    
    RAISE NOTICE 'Constraint UNIQUE agregada a tenantId en Subscription';
  ELSE
    RAISE NOTICE 'Constraint UNIQUE ya existe en tenantId';
  END IF;
END $$;

-- Verificar que la constraint se creó correctamente
SELECT 
  conname AS constraint_name,
  contype AS constraint_type,
  pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conrelid = 'Subscription'::regclass
  AND conname = 'Subscription_tenantId_key';
```

## Verificación
Después de ejecutar, deberías ver:
- Un mensaje de éxito indicando que la constraint fue agregada
- Una fila en el SELECT final mostrando la constraint `Subscription_tenantId_key`

## Impacto
- ✅ Permite usar `upsert` con `where: { tenantId }` en Prisma
- ✅ Garantiza que cada tenant solo tenga una suscripción activa
- ⚠️ Si ya existen múltiples suscripciones para el mismo tenant, la migración fallará
  - En ese caso, primero limpiar suscripciones duplicadas:
    ```sql
    -- Verificar duplicados
    SELECT "tenantId", COUNT(*) 
    FROM "Subscription" 
    GROUP BY "tenantId" 
    HAVING COUNT(*) > 1;
    
    -- Eliminar duplicados (mantener la más reciente)
    DELETE FROM "Subscription" s1
    WHERE EXISTS (
      SELECT 1 FROM "Subscription" s2
      WHERE s2."tenantId" = s1."tenantId"
        AND s2."createdAt" > s1."createdAt"
    );
    ```

## Nota
El schema de Prisma ya fue actualizado con `tenantId @unique`, pero la base de datos necesita esta migración manual porque Prisma no genera migraciones automáticas para cambios de constraints en producción.

