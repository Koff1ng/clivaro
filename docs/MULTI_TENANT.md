# Sistema Multi-Tenant - Guía de Acceso

## ¿Cómo accede un tenant a su aplicación?

### Flujo de Acceso

1. **Página Inicial (`/`)**
   - El usuario ingresa el **identificador (slug)** de su empresa
   - Ejemplo: `mi-empresa`, `ferreteria-central`, etc.
   - El sistema verifica que el tenant existe y está activo

2. **Página de Login (`/login/[tenantSlug]`)**
   - Una vez verificado el tenant, el usuario es redirigido a `/login/mi-empresa`
   - Aquí ingresa sus credenciales (usuario/email y contraseña)
   - El sistema autentica al usuario usando la **base de datos específica del tenant**

3. **Dashboard**
   - Una vez autenticado, el usuario accede a su dashboard
   - Todos los datos provienen de la base de datos del tenant

### Arquitectura

#### Base de Datos Maestra
- Almacena: `Tenant`, `Plan`, `Subscription`
- Usada por: Super administradores
- Ubicación: `prisma/dev.db` (SQLite)

#### Bases de Datos por Tenant
- Cada tenant tiene su propia base de datos
- URL almacenada en: `Tenant.databaseUrl`
- Ejemplo: `file:./tenants/tenant-1.db`

### Identificación del Tenant

El sistema identifica el tenant de tres formas:

1. **URL Path**: `/login/mi-empresa` → slug = `mi-empresa`
2. **Header HTTP**: `X-Tenant-Slug: mi-empresa`
3. **Sesión del Usuario**: Una vez autenticado, el `tenantId` se guarda en la sesión JWT

### Autenticación

- **Super Admin**: Usa la base de datos maestra
- **Usuarios de Tenant**: Usan la base de datos del tenant especificada en `Tenant.databaseUrl`

### Crear un Nuevo Tenant

1. Desde el Panel Admin (`/admin/tenants`), crear un nuevo tenant
2. Especificar:
   - Nombre de la empresa
   - Slug único (ej: `mi-empresa`)
   - URL de la base de datos (ej: `file:./tenants/mi-empresa.db`)
3. Asignar un plan y crear la suscripción
4. Inicializar la base de datos del tenant (ejecutar migraciones Prisma)

### Inicialización Automática

Cuando se crea un nuevo tenant desde el Panel Admin (`/admin/tenants`), el sistema automáticamente:

1. ✅ Crea el **schema PostgreSQL** del tenant (`tenant_{id}`)
2. ✅ Ejecuta el DDL embebido en `lib/tenant-sql-statements.ts` (generado desde `prisma/supabase-init.sql` con `npm run generate:tenant-sql`)
3. ✅ Sincroniza columnas adicionales (legal, SoftRestaurant, **Invoice.tipAmount**, **Invoice/CreditNote Alegra** (`alegraId`, `alegraNumber`, `alegraStatus`, `alegraUrl`), restaurante)
4. ✅ Crea permisos y roles (incluye **`manage_restaurant`** para ADMIN, cajero y rol de mesero)
5. ✅ Crea un usuario administrador por defecto
6. ✅ Crea un almacén principal y configuración contable base

**Si cambias el modelo Prisma / tablas de tenant:** actualiza `prisma/supabase-init.sql`, ejecuta `npm run generate:tenant-sql` y vuelve a desplegar, para que los **próximos** tenants reciban el DDL nuevo. Los tenants ya existentes pueden alinearse con `POST /api/admin/migrate-tenants` (super admin) o los scripts en `scripts/`.

**Error Prisma `alegraStatus` / columnas Alegra en `Invoice`:** el schema de Prisma incluye campos de integración Alegra que faltaban en DDL antiguo de tenants. Tras desplegar este cambio, ejecuta **`POST /api/admin/migrate-tenants`** (sesión super admin) o aplica manualmente en cada schema `tenant_*` los `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` equivalentes a los del endpoint. Los nuevos tenants creados con la inicialización estándar ya reciben las columnas vía `tenant-sql-statements.ts` regenerado.

### Supabase CLI (migraciones en la nube)

El proyecto incluye el CLI como dependencia de desarrollo (`supabase`) y `supabase/config.toml` (vía `npx supabase init`). La migración **`supabase/migrations/20260320120000_tenant_invoice_alegra_columns.sql`** recorre todos los esquemas `tenant_*` y añade columnas/índices Alegra en `Invoice` y `CreditNote`.

```bash
npm install
npx supabase login
npx supabase link --project-ref <TU_PROJECT_REF>
npm run supabase:db:push
```

Scripts útiles: `npm run supabase:start` (Postgres local), `npm run supabase:db:reset` (reaplica migraciones en local), `npm run supabase:db:push` (remoto enlazado).

**Credenciales por Defecto:**
- **Usuario**: `admin`
- **Contraseña**: `Admin123!`

⚠️ **IMPORTANTE**: El sistema mostrará estas credenciales al crear el tenant. El usuario debe cambiar la contraseña después del primer inicio de sesión.

### Inicialización Manual (Opcional)

Si necesitas inicializar manualmente una base de datos de tenant:

```bash
# 1. Crear el archivo de base de datos (si no existe)
# 2. Ejecutar migraciones en la BD del tenant
DATABASE_URL="file:./tenants/mi-empresa.db" npx prisma migrate deploy

# 3. Usar la función de inicialización
# (Ver lib/initialize-tenant.ts)
```

### Ejemplo de Uso

1. **Cliente accede a**: `https://clivaro.com/`
2. **Ingresa slug**: `ferreteria-central`
3. **Sistema verifica** que existe y está activo
4. **Redirige a**: `/login/ferreteria-central`
5. **Usuario ingresa credenciales**
6. **Sistema autentica** usando `ferreteria-central.db`
7. **Usuario accede** a su dashboard con sus datos

### Notas Importantes

- Cada tenant tiene **completamente aislados** sus datos
- Los super admins pueden acceder a la BD maestra para gestionar tenants
- El slug del tenant debe ser único y URL-friendly (solo letras, números y guiones)
- Las bases de datos de los tenants pueden estar en diferentes ubicaciones (local, servidor, cloud)

