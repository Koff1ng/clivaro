# Guía: Migración Masiva `updatedAt` para Todos los Tenants

## 🎯 Objetivo

Aplicar la migración de `updatedAt` en la tabla `Payment` a **todos los tenants** automáticamente.

## 📋 Opciones Disponibles

### Opción 1: Script TypeScript (Recomendado) ⭐

**Usa esto si cada tenant tiene su propia base de datos** (caso más común en Supabase).

#### Requisitos

- Node.js instalado
- Acceso a la base de datos master (donde está la tabla `Tenant`)
- Variables de entorno configuradas (`.env` con `DATABASE_URL`)

#### Pasos

1. **Asegúrate de tener las variables de entorno configuradas:**
   ```bash
   # .env
   DATABASE_URL="postgresql://..." # Base de datos master
   ```

2. **Instala las dependencias si no las tienes:**
   ```bash
   npm install
   ```

3. **Ejecuta el script:**
   ```bash
   npx tsx scripts/migrate-all-tenants-updatedat.ts
   ```

   O con ts-node:
   ```bash
   npx ts-node scripts/migrate-all-tenants-updatedat.ts
   ```

#### ¿Qué hace el script?

1. ✅ Se conecta a la base de datos master
2. ✅ Obtiene todos los tenants activos
3. ✅ Filtra solo tenants con PostgreSQL (ignora SQLite)
4. ✅ Para cada tenant:
   - Se conecta a su base de datos
   - Ejecuta la migración SQL
   - Verifica que la columna se creó correctamente
   - Cierra la conexión
5. ✅ Muestra un resumen con éxitos y errores

#### Salida Esperada

```
🚀 Iniciando migración de updatedAt para todos los tenants...

📊 Encontrados 5 tenant(s) activo(s)

📊 5 tenant(s) con PostgreSQL encontrado(s)

🔄 Procesando tenant: Ferretería Central (ferreteria-central)
   URL: postgresql://postgres:password@db.xxxxx...
   ✅ Migración exitosa para Ferretería Central

🔄 Procesando tenant: Tienda ABC (tienda-abc)
   URL: postgresql://postgres:password@db.yyyyy...
   ✅ Migración exitosa para Tienda ABC

...

============================================================
📊 Resumen de migración:
   ✅ Exitosos: 5
   ❌ Errores: 0
   📦 Total: 5
============================================================

✅ Proceso completado
```

### Opción 2: Script SQL (Solo si todos comparten la misma BD)

**Usa esto SOLO si todos los tenants están en el mismo proyecto de Supabase y comparten el mismo esquema `public`** (caso poco común).

#### Pasos

1. Abre el **SQL Editor** de Supabase
2. Asegúrate de estar conectado a la base de datos correcta
3. Copia y pega el contenido de `scripts/migrate-all-tenants-updatedat.sql`
4. Ejecuta el script

#### ⚠️ Limitaciones

- Solo funciona si todos los tenants comparten la misma base de datos
- Si cada tenant tiene su propia base de datos, este script NO funcionará
- En ese caso, usa la **Opción 1 (TypeScript)**

## 🔍 Verificación

Después de ejecutar cualquiera de los scripts, verifica que la migración funcionó:

### Para un tenant específico:

```sql
-- Conecta a la base de datos del tenant
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

Deberías ver:
- `column_name`: `updatedAt`
- `data_type`: `timestamp without time zone`
- `is_nullable`: `NO`
- `column_default`: `CURRENT_TIMESTAMP`

## 🐛 Troubleshooting

### Error: "Cannot find module '@prisma/client'"

**Solución:**
```bash
npm install
npx prisma generate --schema=prisma/schema.postgres.prisma
```

### Error: "P1001: Can't reach database server"

**Causa:** La URL de la base de datos del tenant es incorrecta o inaccesible.

**Solución:**
1. Verifica que las URLs de los tenants en la tabla `Tenant` sean correctas
2. Verifica que tengas acceso de red a esas bases de datos
3. Si usas Supabase, verifica que las credenciales sean correctas

### Error: "Table Payment does not exist"

**Causa:** El tenant no tiene la tabla `Payment` (puede ser un tenant nuevo o mal configurado).

**Solución:** 
- El script mostrará un mensaje de advertencia pero continuará con los demás tenants
- Verifica que el tenant tenga las migraciones de Prisma aplicadas

### Algunos tenants fallan pero otros funcionan

**Causa:** Algunos tenants pueden tener configuraciones diferentes o problemas de conexión.

**Solución:**
- El script continuará procesando los demás tenants
- Revisa los errores en la salida del script
- Ejecuta la migración manualmente para los tenants que fallaron

## 📝 Notas Importantes

- ✅ El script es **idempotente**: puedes ejecutarlo múltiples veces sin problemas
- ✅ Solo procesa tenants **activos** (`active: true`)
- ✅ Solo procesa tenants con **PostgreSQL** (ignora SQLite)
- ✅ No afecta datos existentes: los registros se actualizan con `createdAt` si `updatedAt` es NULL
- ⚠️ El script TypeScript requiere acceso a todas las bases de datos de los tenants

## 🚀 Ejecución en Producción

Si estás ejecutando esto en producción:

1. **Haz un backup** de las bases de datos antes de ejecutar
2. **Ejecuta primero en un entorno de prueba** si es posible
3. **Ejecuta durante horas de bajo tráfico** para minimizar el impacto
4. **Monitorea los logs** durante la ejecución

## 📚 Archivos Relacionados

- `scripts/migrate-all-tenants-updatedat.ts` - Script TypeScript (recomendado)
- `scripts/migrate-all-tenants-updatedat.sql` - Script SQL (solo si comparten BD)
- `scripts/migrate-payment-updatedat.sql` - Script para un solo tenant
- `GUIA_MIGRACION_PAYMENT_UPDATEDAT.md` - Guía para migración individual

