# Implementación Completa - Arquitectura Multi-Tenant

## ✅ Funcionalidades Implementadas

### 1. Transaction Pooler + Direct URL
- **DATABASE_URL**: Usa transaction pooler para runtime (ya configurado con `connection_limit=5`)
- **DIRECT_URL**: Activado en `prisma/schema.postgres.prisma` para migraciones
- **Configuración**: Añade `DIRECT_URL` en Vercel con la URL directa de Supabase (sin pooler)

### 2. Prisma Singleton
- ✅ Implementado en `lib/db.ts` (master DB)
- ✅ Implementado en `lib/tenant-db.ts` (tenant DBs con cache global)

### 3. Enforzar tenantId desde Sesión
- ✅ Validación en `lib/api-middleware.ts` (requirePermission/requireAnyPermission)
- ✅ Todos los endpoints de tenant verifican `user.tenantId`
- ✅ Super admin bypass para endpoints globales

### 4. Índices por tenantId
- ✅ Ya existen en `prisma/schema.postgres.prisma`
- ✅ Ver `OPTIMIZACION_BD.md` para índices adicionales recomendados

### 5. Endpoint Unificado de Dashboard + Cache 30s
- ✅ **Nuevo endpoint**: `/api/dashboard` (consolida todos los datos)
- ✅ **Cache**: 30 segundos (Redis si disponible, memoria como fallback)
- ✅ **Datos incluidos**:
  - Stats (ventas, ganancias, productos, stock bajo)
  - Top clients
  - Últimos 30 días
  - Categorías de productos
  - Activity feed (limitado a 10)

**Uso**:
```typescript
// Frontend: Reemplazar múltiples llamadas por una sola
const { data } = useQuery({
  queryKey: ['dashboard'],
  queryFn: async () => {
    const res = await fetch('/api/dashboard')
    return res.json()
  },
  staleTime: 30 * 1000, // 30 segundos
})
```

### 6. Rate Limit por Tenant
- ✅ Implementado en `lib/rate-limit.ts`
- ✅ Integrado en `lib/api-middleware.ts`
- ✅ Clave: `tenantId + userId + IP + endpoint`
- ✅ Soporte para Upstash Redis (distribuido) o memoria (fallback)

### 7. Cola de Jobs (Upstash QStash)
- ✅ Sistema implementado en `lib/jobs/queue.ts`
- ✅ Webhook endpoint: `/api/jobs/process`
- ✅ Fallback a cola en memoria para desarrollo
- ✅ Handlers pre-registrados: `generate_pdf`, `send_email`, `generate_report`

**Configuración**:
1. Crear cuenta en [Upstash QStash](https://upstash.com/docs/qstash)
2. Añadir variables en Vercel:
   - `QSTASH_URL`: `https://qstash.upstash.io/v2`
   - `QSTASH_TOKEN`: Token de tu proyecto QStash
   - `NEXT_PUBLIC_APP_URL`: Tu dominio (ej: `clivaro.vercel.app`)

**Uso**:
```typescript
import { enqueueJob } from '@/lib/jobs/queue'

// Generar PDF en background
await enqueueJob('generate_pdf', {
  invoiceId: 'cmk...',
}, {
  delay: 0, // Inmediato
  maxAttempts: 3,
})

// Enviar email con delay
await enqueueJob('send_email', {
  to: 'cliente@example.com',
  subject: 'Factura #123',
  body: '...',
}, {
  delay: 5, // 5 segundos
})
```

## 📋 Próximos Pasos

### 1. Migrar Frontend al Endpoint Unificado
Actualizar componentes que usan múltiples endpoints:
- `components/dashboard/stats.tsx`
- `components/dashboard/top-clients.tsx`
- `components/dashboard/recent-movements.tsx`

### 2. Implementar Handlers de Jobs
Crear handlers reales en `lib/jobs/handlers/`:
- `pdf-handler.ts`: Generar PDFs de facturas
- `email-handler.ts`: Enviar emails
- `report-handler.ts`: Generar reportes grandes

### 3. Mover Operaciones Pesadas a Cola
Actualizar endpoints que generan PDFs o envían emails:
- `app/api/invoices/[id]/pdf/route.ts` → Usar cola
- `app/api/quotations/[id]/send/route.ts` → Usar cola
- `app/api/dashboard/monthly-report/route.ts` → Usar cola

### 4. Configurar Variables de Entorno
En Vercel, añadir:
```
DIRECT_URL=postgresql://... (URL directa de Supabase, sin pooler)
QSTASH_URL=https://qstash.upstash.io/v2
QSTASH_TOKEN=tu_token_aqui
NEXT_PUBLIC_APP_URL=clivaro.vercel.app
UPSTASH_REDIS_REST_URL=... (opcional, para cache distribuido)
UPSTASH_REDIS_REST_TOKEN=... (opcional)
```

## 🔍 Verificación

### Verificar Cache
```bash
# El endpoint debe retornar X-Cache: HIT en la segunda llamada
curl https://clivaro.vercel.app/api/dashboard
```

### Verificar Rate Limit
```bash
# Hacer muchas requests rápidas, debería retornar 429
for i in {1..200}; do curl https://clivaro.vercel.app/api/dashboard; done
```

### Verificar Jobs
```bash
# Ver logs en Vercel para jobs procesados
# O verificar en Upstash dashboard
```

## 📊 Mejoras de Rendimiento Esperadas

1. **Dashboard**: De 5-10 requests → 1 request (reducción de 80-90%)
2. **Cache**: Reducción de queries a BD en 70-80% para datos frecuentes
3. **Jobs**: PDFs y emails no bloquean requests (mejor UX)
4. **Rate Limit**: Protección contra abuso y picos de tráfico

