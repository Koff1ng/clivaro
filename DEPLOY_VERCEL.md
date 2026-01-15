# 🚀 Guía de Deploy en Vercel

## 📋 Prerrequisitos

1. Cuenta en [Vercel](https://vercel.com) (gratis)
2. Repositorio en GitHub, GitLab o Bitbucket
3. Base de datos PostgreSQL configurada (Supabase, Railway, Neon, etc.)

---

## 🔧 Paso 1: Preparar el Proyecto

### 1.1 Verificar configuración

El proyecto ya tiene:
- ✅ `vercel.json` configurado
- ✅ `next.config.js` optimizado
- ✅ Scripts de build en `package.json`

### 1.2 Variables de Entorno Necesarias

Prepara estas variables para configurar en Vercel:

```env
# Base de Datos (OBLIGATORIO)
DATABASE_URL="postgresql://user:password@host:5432/database?schema=public"

# NextAuth (OBLIGATORIO)
NEXTAUTH_URL="https://tu-app.vercel.app"
NEXTAUTH_SECRET="genera-un-secret-seguro-con-openssl-rand-base64-32"

# Email SMTP (Opcional pero recomendado)
SMTP_HOST="smtp.gmail.com"
SMTP_PORT="587"
SMTP_USER="tu-email@gmail.com"
SMTP_PASSWORD="tu-app-password" # No guardes credenciales reales en el repo; usa variables en Vercel
SMTP_FROM="ClientumExpress <noreply@tu-dominio.com>"
SMTP_SECURE="false"

# Rate limiting (RECOMENDADO en producción / Vercel)
# Upstash Redis (REST)
UPSTASH_REDIS_REST_URL="https://xxxxx.upstash.io"
UPSTASH_REDIS_REST_TOKEN="xxxxx"

# Otros
NODE_ENV="production"
COMPANY_NAME="Tu Empresa"
```

---

## 🚀 Paso 2: Deploy en Vercel

### Opción A: Deploy desde Dashboard (Recomendado)

1. **Ir a [vercel.com](https://vercel.com)**
   - Inicia sesión con GitHub/GitLab/Bitbucket

2. **Importar Proyecto**
   - Click en "Add New Project"
   - Selecciona tu repositorio
   - Vercel detectará automáticamente que es Next.js

3. **Configurar Variables de Entorno**
   - En la sección "Environment Variables"
   - Agrega todas las variables listadas arriba
   - Marca "Production", "Preview" y "Development"

4. **Configurar Build Settings**
   - Build Command: `prisma generate && next build`
   - Output Directory: `.next` (automático)
   - Install Command: `npm install`

5. **Deploy**
   - Click en "Deploy"
   - Espera 2-5 minutos
   - ¡Listo! Tu app estará en `https://tu-app.vercel.app`

### Opción B: Deploy desde CLI

```bash
# Instalar Vercel CLI
npm i -g vercel

# Login
vercel login

# Deploy (primera vez)
vercel

# Deploy a producción
vercel --prod
```

---

## 🗄️ Paso 3: Configurar Base de Datos

### Opción 1: Supabase (Recomendado - Gratis)

1. Crear cuenta en [supabase.com](https://supabase.com)
2. Crear nuevo proyecto
3. Ir a Settings → Database
4. Copiar "Connection string" (URI)
5. Agregar como `DATABASE_URL` en Vercel

### Opción 2: Railway

1. Crear cuenta en [railway.app](https://railway.app)
2. New Project → Database → PostgreSQL
3. Copiar DATABASE_URL
4. Agregar en Vercel

### Opción 3: Neon

1. Crear cuenta en [neon.tech](https://neon.tech)
2. Crear proyecto
3. Copiar connection string
4. Agregar en Vercel

---

## 🔐 Paso 4: Generar NEXTAUTH_SECRET

```bash
# En tu terminal local
openssl rand -base64 32
```

Copia el resultado y úsalo como `NEXTAUTH_SECRET` en Vercel.

---

## 📊 Paso 5: Ejecutar Migraciones

### Opción A: Desde Vercel (Recomendado)

1. Ir a tu proyecto en Vercel
2. Settings → Functions
3. Agregar un script de post-deploy (opcional)

### Opción B: Desde tu máquina local

```bash
# Conectar a la base de datos de producción
export DATABASE_URL="tu-database-url-de-produccion"

# Ejecutar migraciones
npx prisma migrate deploy

# Verificar
npx prisma migrate status
```

### Opción C: Crear API Route para Migraciones

Crear `app/api/admin/migrate/route.ts` (solo para uso interno):

```typescript
import { NextResponse } from 'next/server'
import { execSync } from 'child_process'

export async function POST(request: Request) {
  // Solo permitir desde localhost o con secret
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.MIGRATE_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    execSync('npx prisma migrate deploy', { stdio: 'inherit' })
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: 'Migration failed' }, { status: 500 })
  }
}
```

---

## ✅ Paso 6: Verificar Deploy

1. **Visitar tu URL**: `https://tu-app.vercel.app`
2. **Verificar que carga correctamente**
3. **Probar login** con credenciales de admin
4. **Revisar logs** en Vercel Dashboard → Logs

---

## 🔄 Paso 7: Configurar Deploy Automático

Vercel automáticamente:
- ✅ Hace deploy en cada push a `main`/`master`
- ✅ Crea previews para cada PR
- ✅ Notifica por email (opcional)

### Configurar Branch de Producción:

1. Settings → Git
2. Production Branch: `main` (o tu branch principal)

---

## 🐛 Troubleshooting

### Error: "Prisma Client not generated"

**Solución**: Verifica que el build command incluya `prisma generate`:
```
prisma generate && next build
```

### Error: "Database connection failed"

**Solución**:
1. Verifica `DATABASE_URL` en Vercel
2. Asegúrate de que la base de datos permita conexiones externas
3. Verifica firewall/whitelist de IPs (algunos servicios requieren esto)

### Error: "NEXTAUTH_SECRET not set"

**Solución**: Agrega `NEXTAUTH_SECRET` en Vercel Environment Variables

### Error: "Module not found"

**Solución**: 
1. Verifica que todas las dependencias estén en `package.json`
2. Ejecuta `npm install` localmente y commit `package-lock.json`

### Build muy lento

**Solución**:
1. Usa `prisma generate` en build command
2. Considera usar Prisma Data Proxy (opcional)

---

## 📈 Optimizaciones Post-Deploy

### 1. Habilitar Analytics (Opcional)

En Vercel Dashboard:
- Settings → Analytics
- Habilitar Web Analytics (gratis)

### 2. Configurar Dominio Personalizado

1. Settings → Domains
2. Agregar tu dominio
3. Seguir instrucciones de DNS

### 3. Configurar Environment Variables por Entorno

- **Production**: Variables de producción
- **Preview**: Variables de staging (opcional)
- **Development**: Variables de desarrollo

---

## 🔒 Seguridad

### Checklist:

- [ ] `NEXTAUTH_SECRET` es único y seguro
- [ ] `DATABASE_URL` no está en el código
- [ ] Variables sensibles solo en Vercel
- [ ] HTTPS habilitado (automático en Vercel)
- [ ] Rate limiting configurado

---

## 📊 Monitoreo

### Ver Logs:

1. Vercel Dashboard → Tu Proyecto → Logs
2. Filtrar por función/ruta
3. Ver errores en tiempo real

### Analytics:

- Vercel Analytics (gratis)
- Google Analytics (opcional)
- Sentry para error tracking (opcional)

---

## 💰 Costos

### Plan Hobby (Gratis):
- ✅ 100 GB de transferencia/mes
- ✅ Deploy ilimitado
- ✅ SSL/HTTPS incluido
- ✅ Serverless Functions incluidas

**Costo: $0/mes** para la mayoría de proyectos

### Plan Pro ($20/mes):
- ✅ 1 TB de transferencia/mes
- ✅ Analytics avanzado
- ✅ Soporte prioritario

---

## 🎯 Próximos Pasos

1. ✅ Hacer primer deploy
2. ✅ Configurar base de datos
3. ✅ Ejecutar migraciones
4. ✅ Probar aplicación
5. ✅ Configurar dominio personalizado (opcional)
6. ✅ Habilitar analytics (opcional)

---

## 📝 Notas Importantes

1. **Primer deploy**: Puede tardar 3-5 minutos
2. **Deploys subsecuentes**: 1-2 minutos
3. **Variables de entorno**: Se aplican después del próximo deploy
4. **Base de datos**: Debe estar accesible desde internet
5. **Migraciones**: Ejecutar manualmente la primera vez

---

## 🔗 Enlaces Útiles

- [Vercel Dashboard](https://vercel.com/dashboard)
- [Vercel Docs](https://vercel.com/docs)
- [Next.js Deployment](https://nextjs.org/docs/deployment)
- [Prisma Deployment](https://www.prisma.io/docs/guides/deployment)

---

**¡Listo para deploy!** 🚀

Si tienes problemas, revisa los logs en Vercel Dashboard o consulta la sección de Troubleshooting.

