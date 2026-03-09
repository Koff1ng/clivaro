# Optimización de Base de Datos

## Cambios Implementados

### 1. Connection Pool Optimizado
- **Antes**: `connection_limit=1` (muy restrictivo, causaba cuellos de botella)
- **Ahora**: `connection_limit=5` (permite paralelismo sin exceder límites de Supabase)
- **Impacto**: Las queries pueden ejecutarse en paralelo, reduciendo tiempos de espera

### 2. Pool Timeout Aumentado
- **Antes**: `pool_timeout=10` segundos
- **Ahora**: `pool_timeout=20` segundos
- **Impacto**: Menos timeouts cuando hay muchas queries simultáneas

### 3. Queries Paralelas en Dashboard
- **Antes**: Queries ejecutadas secuencialmente
- **Ahora**: Queries independientes ejecutadas en paralelo con `Promise.all`
- **Impacto**: Reducción significativa del tiempo total de respuesta del dashboard

## Índices Recomendados para Mejorar Rendimiento

Ejecuta estos índices en tu base de datos Supabase para mejorar el rendimiento de las queries más frecuentes:

```sql
-- Índices para Invoice (facturas)
CREATE INDEX IF NOT EXISTS idx_invoice_status_created ON "Invoice"("status", "createdAt");
CREATE INDEX IF NOT EXISTS idx_invoice_created_by ON "Invoice"("createdById");
CREATE INDEX IF NOT EXISTS idx_invoice_customer ON "Invoice"("customerId");
CREATE INDEX IF NOT EXISTS idx_invoice_created_at ON "Invoice"("createdAt");

-- Índices para Product (productos)
CREATE INDEX IF NOT EXISTS idx_product_active ON "Product"("active");
CREATE INDEX IF NOT EXISTS idx_product_track_stock ON "Product"("trackStock");

-- Índices para StockLevel (niveles de inventario)
CREATE INDEX IF NOT EXISTS idx_stock_level_product ON "StockLevel"("productId");
CREATE INDEX IF NOT EXISTS idx_stock_level_min_stock ON "StockLevel"("minStock") WHERE "minStock" > 0;

-- Índices para CashShift (turnos de caja)
CREATE INDEX IF NOT EXISTS idx_cash_shift_status ON "CashShift"("status");
CREATE INDEX IF NOT EXISTS idx_cash_shift_user ON "CashShift"("userId");

-- Índices para Payment (pagos)
CREATE INDEX IF NOT EXISTS idx_payment_invoice ON "Payment"("invoiceId");
CREATE INDEX IF NOT EXISTS idx_payment_created_at ON "Payment"("createdAt");

-- Índices para InvoiceItem (items de factura)
CREATE INDEX IF NOT EXISTS idx_invoice_item_invoice ON "InvoiceItem"("invoiceId");
CREATE INDEX IF NOT EXISTS idx_invoice_item_product ON "InvoiceItem"("productId");

-- Índices para StockMovement (movimientos de inventario)
CREATE INDEX IF NOT EXISTS idx_stock_movement_product ON "StockMovement"("productId");
CREATE INDEX IF NOT EXISTS idx_stock_movement_created_at ON "StockMovement"("createdAt");

-- Índices para Customer (clientes)
CREATE INDEX IF NOT EXISTS idx_customer_active ON "Customer"("active");
CREATE INDEX IF NOT EXISTS idx_customer_name ON "Customer"("name");

-- Índices para UserRole (roles de usuario)
CREATE INDEX IF NOT EXISTS idx_user_role_user ON "UserRole"("userId");
CREATE INDEX IF NOT EXISTS idx_user_role_role ON "UserRole"("roleId");
```

## Monitoreo de Rendimiento

### Queries Lentas
Para identificar queries lentas, habilita el logging de Prisma en desarrollo:

```typescript
// Ya está configurado en lib/db.ts y lib/tenant-db.ts
log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error']
```

### Métricas a Monitorear
1. **Tiempo de respuesta de endpoints**:
   - `/api/dashboard/stats` (debería ser < 2s)
   - `/api/activity-feed` (debería ser < 1s)
   - `/api/products` (debería ser < 500ms)

2. **Errores de conexión**:
   - `MaxClientsInSessionMode` (debería ser 0)
   - Timeouts (debería ser < 1%)

3. **Uso del pool**:
   - Conexiones activas (debería estar entre 1-5)
   - Tiempo de espera en cola (debería ser < 100ms)

## Próximas Optimizaciones

1. **Caché de queries frecuentes**: Implementar Redis para cachear resultados de dashboard
2. **Paginación mejorada**: Usar cursor-based pagination para listas grandes
3. **Batch queries**: Agrupar queries relacionadas cuando sea posible
4. **Índices compuestos**: Crear índices compuestos para queries con múltiples filtros

## Notas Importantes

- Los cambios de `connection_limit` y `pool_timeout` requieren reiniciar la aplicación
- Los índices pueden tardar varios minutos en crearse en bases de datos grandes
- Monitorea el uso de conexiones después de aumentar el límite para evitar exceder los límites de Supabase

