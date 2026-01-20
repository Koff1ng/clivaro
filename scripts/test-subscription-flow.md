# Script de Prueba - Flujo de Suscripciones

## 🚀 Prueba Rápida del Sistema

### Paso 1: Verificar que el Endpoint Funciona

Abre tu navegador o usa curl:

```bash
# Verificar que el webhook está activo
curl https://www.clientumstudio.com/api/payments/mercadopago/webhook
```

Deberías recibir:
```json
{
  "status": "ok",
  "message": "Mercado Pago webhook endpoint is active"
}
```

### Paso 2: Crear un Plan de Prueba (SQL)

Ejecuta en tu base de datos Supabase:

```sql
-- Crear plan de prueba mensual
INSERT INTO "Plan" (id, name, description, price, currency, interval, features, active, "createdAt", "updatedAt")
VALUES (
  'test-monthly-' || gen_random_uuid()::text,
  'Plan Prueba Mensual',
  'Plan de prueba para testing - $10,000 COP/mes',
  10000,
  'COP',
  'monthly',
  '{"manageProducts": true, "manageSales": true, "pos": true, "manageInventory": true}',
  true,
  NOW(),
  NOW()
)
ON CONFLICT (name) DO NOTHING
RETURNING id, name;
```

### Paso 3: Probar desde el Frontend

1. **Inicia sesión** como tenant en tu aplicación
2. **Ve a Settings → Subscription**
3. **Selecciona el plan de prueba** que acabas de crear
4. **Completa el formulario de pago** con:

   ```
   Full Name: APRO TEST
   Phone: +57 3001234567
   Email: test@clientumstudio.com
   Card Number: 5031 7557 3453 0604
   Expiration: 11/25
   CVV: 123
   ```

5. **Haz clic en "Pagar"**

### Paso 4: Verificar en la Base de Datos

```sql
-- Ver la suscripción creada
SELECT 
  s.id,
  s.status,
  s."startDate",
  s."endDate",
  s."mercadoPagoPreferenceId",
  s."mercadoPagoStatus",
  p.name as plan_name,
  p.price
FROM "Subscription" s
JOIN "Plan" p ON s."planId" = p.id
WHERE s."tenantId" = 'tu-tenant-id-aqui'
ORDER BY s."createdAt" DESC
LIMIT 1;
```

### Paso 5: Simular Webhook Manualmente (Opcional)

Si Mercado Pago no envía el webhook automáticamente en pruebas, puedes simularlo:

```bash
# Reemplaza SUBSCRIPTION_ID con el ID de tu suscripción
curl -X POST https://www.clientumstudio.com/api/payments/mercadopago/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "type": "payment",
    "data": {
      "id": "1234567890"
    }
  }'
```

**Nota**: Este webhook simulado no funcionará completamente porque Mercado Pago necesita el ID real del pago. Es mejor esperar a que Mercado Pago envíe el webhook automáticamente.

### Paso 6: Verificar Actualización

Después de que Mercado Pago procese el pago (puede tardar unos segundos), verifica nuevamente:

```sql
SELECT 
  s.id,
  s.status,
  s."mercadoPagoPaymentId",
  s."mercadoPagoStatus",
  s."endDate",
  s."autoRenew"
FROM "Subscription" s
WHERE s.id = 'id-de-tu-suscripcion';
```

Deberías ver:
- `status`: `active`
- `mercadoPagoStatus`: `approved`
- `endDate`: fecha futura (1 mes desde ahora)

### Paso 7: Verificar Historial de Pagos

Desde el frontend:
1. Ve a **Settings → Subscription**
2. Busca la sección **"Historial de Pagos"**
3. Deberías ver el pago reciente con estado "Paid"

O desde la API:

```bash
# Necesitas estar autenticado
curl -X GET https://www.clientumstudio.com/api/payments \
  -H "Cookie: tu-session-cookie"
```

## 🧪 Tarjetas de Prueba Completas

### ✅ Aprobada - Visa
```
Número: 5031 7557 3453 0604
CVV: 123
Vencimiento: 11/25 (cualquier fecha futura)
Nombre: APRO
```

### ✅ Aprobada - Mastercard
```
Número: 5031 4332 1540 6351
CVV: 123
Vencimiento: 11/25
Nombre: APRO
```

### ❌ Rechazada - Fondos Insuficientes
```
Número: 5031 7557 3453 0604
CVV: 123
Vencimiento: 11/25
Nombre: OTHE
```

### ❌ Rechazada - Datos Inválidos
```
Número: 5031 7557 3453 0604
CVV: 123
Vencimiento: 11/25
Nombre: CONT
```

## 📊 Verificar Logs en Vercel

1. Ve a tu proyecto en Vercel
2. Click en **"Logs"** en el menú superior
3. Busca por:
   - `"subscription"` - para ver creación de suscripciones
   - `"webhook"` - para ver webhooks recibidos
   - `"Mercado Pago"` - para ver todas las interacciones con MP

## ✅ Checklist de Prueba Completa

- [ ] Webhook endpoint responde correctamente
- [ ] Plan de prueba creado en la base de datos
- [ ] Suscripción creada desde el frontend
- [ ] Preapproval creado en Mercado Pago (verificar en logs)
- [ ] Pago procesado con tarjeta de prueba
- [ ] Webhook recibido y procesado (verificar en logs de Vercel)
- [ ] Suscripción actualizada a estado `active`
- [ ] Fechas de renovación calculadas correctamente
- [ ] Historial de pagos muestra el pago
- [ ] Cancelación funciona (opcional)

## 🔍 Debugging

### Ver todos los logs relacionados con suscripciones:

En Vercel Logs, busca:
```
subscription
webhook
Mercado Pago
Preapproval
```

### Ver respuesta completa de Mercado Pago:

```sql
SELECT 
  id,
  "mercadoPagoPreferenceId",
  "mercadoPagoResponse"
FROM "Subscription"
WHERE "tenantId" = 'tu-tenant-id'
ORDER BY "createdAt" DESC
LIMIT 1;
```

El campo `mercadoPagoResponse` contiene el JSON completo de la respuesta.

## ⚠️ Problemas Comunes

### "Error al crear la suscripción"
- Verifica que las credenciales de Mercado Pago estén configuradas
- Asegúrate de usar credenciales de prueba (TEST-)
- Revisa los logs de Vercel para el error específico

### "Webhook no se recibe"
- Verifica que la URL esté correcta en Mercado Pago
- Asegúrate de que el endpoint esté desplegado
- Revisa los logs de Vercel

### "Suscripción no se actualiza"
- Verifica que el webhook se haya recibido (logs)
- Revisa que el `external_reference` coincida
- Verifica que no haya errores en el procesamiento del webhook

