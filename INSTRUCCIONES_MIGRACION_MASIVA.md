# Instrucciones: Migración Masiva `updatedAt` para Todos los Tenants

## 🔴 Situación Actual

El script TypeScript no puede ejecutarse desde tu entorno local porque no puede conectarse a la base de datos de Supabase (probablemente por restricciones de red/firewall).

## ✅ Soluciones Disponibles

### Opción 1: Ejecutar SQL Directamente en Supabase (Recomendado) ⭐

Si **todos los tenants están en el mismo proyecto de Supabase** y comparten el esquema `public`:

1. **Abre el SQL Editor de Supabase**
2. **Copia y pega** el contenido de `scripts/migrate-all-tenants-supabase.sql`
3. **Ejecuta el script**
4. **Verifica** que la columna se creó correctamente

### Opción 2: Migración Individual por Tenant

Si **cada tenant tiene su propia base de datos separada**:

1. **Obtén la lista de tenants:**
   - Ve al Panel Admin → Tenants
   - O ejecuta esta consulta en Supabase:
   ```sql
   SELECT id, name, slug, databaseUrl 
   FROM "Tenant" 
   WHERE active = true;
   ```

2. **Para cada tenant:**
   - Conecta a su base de datos en Supabase
   - Ejecuta el script `scripts/migrate-payment-updatedat.sql`
   - Verifica que la columna se creó

### Opción 3: Ejecutar Script TypeScript desde el Servidor

Si tienes acceso SSH o puedes ejecutar scripts en el servidor de producción:

1. **Conecta al servidor** (Vercel, Railway, etc.)
2. **Ejecuta:**
   ```bash
   npx tsx scripts/migrate-all-tenants-updatedat.ts
   ```

## 📋 Pasos Detallados para Opción 1 (SQL Directo)

### Paso 1: Abrir SQL Editor en Supabase

1. Ve a tu proyecto de Supabase
2. Navega a **SQL Editor** en el menú lateral
3. Haz clic en **New Query**

### Paso 2: Ejecutar el Script

1. Abre el archivo `scripts/migrate-all-tenants-supabase.sql`
2. Copia todo el contenido
3. Pégalo en el SQL Editor de Supabase
4. Haz clic en **Run** o presiona `Ctrl+Enter` (Windows) / `Cmd+Enter` (Mac)

### Paso 3: Verificar Resultados

Deberías ver mensajes como:
- `✅ Tabla Payment encontrada en esquema public`
- `✅ Columna updatedAt agregada exitosamente`
- `✅ Registros existentes actualizados`

Y una tabla con la estructura de la columna `updatedAt`.

## 📋 Pasos Detallados para Opción 2 (Individual)

### Paso 1: Obtener Lista de Tenants

Ejecuta en Supabase SQL Editor (base de datos master):

```sql
SELECT 
    id,
    name,
    slug,
    active,
    databaseUrl,
    CASE 
        WHEN databaseUrl LIKE 'postgresql://%' OR databaseUrl LIKE 'postgres://%' 
        THEN 'PostgreSQL' 
        ELSE 'SQLite' 
    END as database_type
FROM "Tenant"
WHERE active = true
ORDER BY name;
```

### Paso 2: Para Cada Tenant con PostgreSQL

1. **Identifica la base de datos del tenant:**
   - Si todos están en el mismo proyecto: usa el mismo SQL Editor
   - Si cada uno tiene su propio proyecto: abre el proyecto correspondiente

2. **Ejecuta el script individual:**
   - Abre `scripts/migrate-payment-updatedat.sql`
   - Copia y pega en el SQL Editor
   - Ejecuta

3. **Verifica:**
   ```sql
   SELECT column_name, data_type 
   FROM information_schema.columns 
   WHERE table_name = 'Payment' 
   AND column_name = 'updatedAt';
   ```

## 🔍 Verificación Final

Después de ejecutar la migración, verifica que funcionó:

```sql
-- Verificar estructura de Payment
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

## ⚠️ Notas Importantes

- ✅ La migración es **idempotente**: puedes ejecutarla múltiples veces sin problemas
- ✅ No afecta datos existentes: los registros se actualizan con `createdAt` si `updatedAt` es NULL
- ⚠️ Si cada tenant tiene su propia base de datos, necesitas ejecutar la migración en cada una
- ⚠️ Si todos los tenants comparten la misma base de datos, una sola ejecución es suficiente

## 🐛 Troubleshooting

### Error: "Table Payment does not exist"

**Causa:** Estás conectado a la base de datos incorrecta (probablemente la master en lugar de la del tenant).

**Solución:** Verifica que estés conectado a la base de datos del tenant.

### Error: "Column already exists"

**Causa:** La migración ya se ejecutó anteriormente.

**Solución:** Esto es normal, la migración es idempotente. Verifica que la columna existe.

### El error persiste después de la migración

**Causa:** Prisma Client necesita regenerarse o hay caché.

**Solución:**
1. Regenera Prisma Client: `npx prisma generate --schema=prisma/schema.postgres.prisma`
2. Reinicia el servidor de desarrollo/producción
3. Limpia la caché de Vercel si estás en producción

## 📚 Archivos Relacionados

- `scripts/migrate-all-tenants-supabase.sql` - Script SQL para ejecutar en Supabase (si comparten BD)
- `scripts/migrate-payment-updatedat.sql` - Script SQL para un solo tenant
- `scripts/migrate-all-tenants-updatedat.ts` - Script TypeScript (requiere acceso a todas las BDs)
- `GUIA_MIGRACION_MASIVA_UPDATEDAT.md` - Guía completa con todas las opciones

