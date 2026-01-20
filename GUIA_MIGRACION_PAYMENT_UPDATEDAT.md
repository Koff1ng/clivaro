# Guía: Migración `updatedAt` en Payment para POS

## 🔴 Problema

Al intentar procesar un pago en el **Punto de Venta (POS)**, aparece el error:
```
Error al procesar la venta: Invalid `prisma.payment.create()` invocation: 
The column `updatedAt` does not exist in the current database.
```

## 🔍 Causa

El sistema es **multi-tenant**. Cada tenant tiene su propia base de datos. El error ocurre porque:

1. La columna `updatedAt` existe en el schema de Prisma
2. Pero **NO existe** en la base de datos del tenant que está usando el POS
3. La migración SQL se ejecutó solo en la base de datos master (o en otro tenant)

## ✅ Solución

### Paso 1: Identificar el Tenant

1. **Inicia sesión** en la aplicación como administrador
2. Ve al **Panel Admin** → **Tenants**
3. **Identifica el tenant** que está experimentando el error:
   - Es el tenant desde el cual estás intentando hacer ventas en el POS
   - O el tenant que aparece en la URL cuando haces login (ej: `/login/mi-empresa`)

### Paso 2: Obtener la URL de la Base de Datos

1. En la lista de tenants, **busca el tenant** que identificaste
2. **Copia la `databaseUrl`** de ese tenant
   - Ejemplo: `postgresql://postgres:password@db.xxxxx.supabase.co:5432/postgres`

### Paso 3: Conectar a la Base de Datos del Tenant

**Opción A: Si todos los tenants están en el mismo proyecto de Supabase**

1. Ve al **SQL Editor** de Supabase
2. Si tienes múltiples bases de datos, **selecciona la conexión correcta** o cambia el esquema
3. Si no estás seguro, verifica la URL de conexión en la configuración del proyecto

**Opción B: Si cada tenant tiene su propio proyecto de Supabase**

1. Abre el proyecto de Supabase correspondiente al tenant
2. Ve al **SQL Editor** de ese proyecto
3. Asegúrate de estar conectado a la base de datos correcta

### Paso 4: Ejecutar la Migración

1. Abre el archivo `scripts/migrate-payment-updatedat.sql`
2. **Copia todo el contenido** del script
3. **Pégalo en el SQL Editor** de Supabase (conectado a la base de datos del tenant)
4. **Ejecuta el script**
5. Verifica que aparezcan mensajes de éxito:
   - `✅ Tabla Payment encontrada`
   - `✅ Columna updatedAt agregada exitosamente`
   - `✅ Registros existentes actualizados`

### Paso 5: Verificar

Después de ejecutar el script, deberías ver una tabla con la estructura de `Payment`, incluyendo la columna `updatedAt` con:
- `data_type`: `timestamp without time zone`
- `is_nullable`: `NO`
- `column_default`: `CURRENT_TIMESTAMP`

## 🔄 Si Tienes Múltiples Tenants

Si tienes múltiples tenants y todos usan el POS, necesitas ejecutar esta migración en **cada base de datos de tenant**:

1. Repite los pasos 1-4 para cada tenant
2. O crea un script automatizado que itere sobre todos los tenants

## ⚠️ Notas Importantes

- ✅ Esta migración es **idempotente**: puedes ejecutarla múltiples veces sin problemas
- ✅ Si la columna ya existe, el script simplemente mostrará un mensaje informativo
- ✅ No afecta datos existentes: los registros se actualizan con `createdAt` si `updatedAt` es NULL
- ⚠️ **NO ejecutes esto en la base de datos master** a menos que también uses el POS desde ahí (poco común)

## 🐛 Troubleshooting

### Error: "Tabla Payment no existe"
- **Causa**: Estás conectado a la base de datos incorrecta
- **Solución**: Verifica que estás conectado a la base de datos del tenant (no la master)

### Error: "relation already exists"
- **Causa**: La columna ya existe
- **Solución**: Esto es normal, el script es idempotente. Verifica que la columna existe con el SELECT de verificación

### El error persiste después de la migración
- **Causa**: Prisma Client necesita regenerarse o hay caché
- **Solución**: 
  1. Regenera Prisma Client: `npx prisma generate --schema=prisma/schema.postgres.prisma`
  2. Reinicia el servidor de desarrollo/producción
  3. Limpia la caché de Vercel si estás en producción

## 📝 Script SQL Completo

El script completo está en: `scripts/migrate-payment-updatedat.sql`

