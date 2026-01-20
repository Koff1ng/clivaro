# Guía de Prueba - Sistema de Suscripciones con Mercado Pago

## 🧪 Tarjetas de Prueba de Mercado Pago

Mercado Pago proporciona tarjetas de prueba para simular diferentes escenarios de pago.

### Tarjetas de Prueba Aprobadas

#### Tarjeta de Crédito - Aprobada
```
Número: 5031 7557 3453 0604
CVV: 123
Fecha de vencimiento: 11/25 (cualquier fecha futura)
Nombre del titular: APRO
```

#### Tarjeta de Débito - Aprobada
```
Número: 5031 4332 1540 6351
CVV: 123
Fecha de vencimiento: 11/25
Nombre del titular: APRO
```

### Tarjetas de Prueba Rechazadas (para probar errores)

#### Tarjeta Rechazada por Fondos Insuficientes
```
Número: 5031 7557 3453 0604
CVV: 123
Fecha de vencimiento: 11/25
Nombre del titular: OTHE
```

#### Tarjeta Rechazada por Datos Inválidos
```
Número: 5031 7557 3453 0604
CVV: 123
Fecha de vencimiento: 11/25
Nombre del titular: CONT
```

## 📋 Pasos para Probar el Sistema

### 1. Verificar Credenciales de Prueba

Asegúrate de tener configuradas las credenciales de **prueba** (sandbox) en Vercel:

```
MERCADOPAGO_ACCESS_TOKEN=TEST-... (debe empezar con TEST-)
MERCADOPAGO_PUBLIC_KEY=TEST-... (debe empezar con TEST-)
```

### 2. Crear un Plan de Prueba en la Base de Datos

Ejecuta este SQL en tu base de datos para crear un plan de prueba:

```sql
INSERT INTO "Plan" (id, name, description, price, currency, interval, features, active, "createdAt", "updatedAt")
VALUES (
  'test-plan-monthly',
  'Plan de Prueba Mensual',
  'Plan de prueba para testing',
  10000,  -- $10,000 COP
  'COP',
  'monthly',
  '{"manageProducts": true, "manageSales": true, "pos": true}',
  true,
  NOW(),
  NOW()
);
```

### 3. Probar el Flujo Completo

#### Paso 1: Crear Suscripción (Frontend)

1. Inicia sesión en tu aplicación como tenant
2. Ve a Settings → Subscription
3. Selecciona el plan de prueba
4. Ingresa los datos de la tarjeta de prueba:
   - Número: `5031 7557 3453 0604`
   - CVV: `123`
   - Vencimiento: `11/25`
   - Nombre: `APRO`
   - Email: tu email de prueba

#### Paso 2: Verificar en Base de Datos

Después de crear la suscripción, verifica en la base de datos:

```sql
SELECT 
  id,
  "tenantId",
  "planId",
  status,
  "startDate",
  "endDate",
  "mercadoPagoPreferenceId",
  "mercadoPagoStatus",
  "autoRenew"
FROM "Subscription"
WHERE "tenantId" = 'tu-tenant-id'
ORDER BY "createdAt" DESC
LIMIT 1;
```

Deberías ver:
- `status`: `pending_payment`
- `mercadoPagoPreferenceId`: ID del Preapproval creado
- `mercadoPagoStatus`: `pending` o `authorized`

#### Paso 3: Simular Webhook de Pago

Mercado Pago enviará el webhook automáticamente, pero puedes simularlo manualmente:

**Opción A: Usar cURL**

```bash
curl -X POST https://www.clientumstudio.com/api/payments/mercadopago/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "type": "payment",
    "data": {
      "id": "1234567890"
    }
  }'
```

**Opción B: Usar el Panel de Mercado Pago**

1. Ve a tu aplicación en Mercado Pago Developers
2. Busca la sección "Webhooks" o "Notificaciones"
3. Haz clic en "Probar webhook" o "Enviar notificación de prueba"
4. Selecciona el tipo: `payment`
5. Ingresa un ID de pago de prueba

#### Paso 4: Verificar Actualización de Suscripción

Después del webhook, verifica nuevamente en la base de datos:

```sql
SELECT 
  id,
  status,
  "startDate",
  "endDate",
  "mercadoPagoPaymentId",
  "mercadoPagoStatus",
  "mercadoPagoStatusDetail"
FROM "Subscription"
WHERE id = 'id-de-tu-suscripcion';
```

Deberías ver:
- `status`: `active` (si el pago fue aprobado)
- `mercadoPagoStatus`: `approved`
- `endDate`: fecha futura (1 mes o 1 año según el plan)

### 4. Probar Cancelación

#### Paso 1: Cancelar Suscripción

Desde el frontend o usando la API:

```bash
curl -X POST https://www.clientumstudio.com/api/subscriptions/cancel \
  -H "Content-Type: application/json" \
  -H "Cookie: tu-session-cookie" \
  -d '{
    "cancelAtPeriodEnd": false
  }'
```

#### Paso 2: Verificar Cancelación

```sql
SELECT 
  id,
  status,
  "autoRenew",
  "mercadoPagoStatus"
FROM "Subscription"
WHERE id = 'id-de-tu-suscripcion';
```

Deberías ver:
- `status`: `cancelled`
- `autoRenew`: `false`
- `mercadoPagoStatus`: `cancelled`

### 5. Verificar Historial de Pagos

Consulta el endpoint de pagos:

```bash
curl -X GET https://www.clientumstudio.com/api/payments \
  -H "Cookie: tu-session-cookie"
```

Deberías ver un array con los pagos procesados.

## 🔍 Verificar Logs

### En Vercel

1. Ve a tu proyecto en Vercel
2. Click en "Logs"
3. Filtra por "subscription" o "webhook"
4. Revisa los logs para ver:
   - Creación de suscripción
   - Recepción de webhooks
   - Actualizaciones de estado

### En la Base de Datos

Revisa los campos `mercadoPagoResponse` en la tabla `Subscription`:

```sql
SELECT 
  id,
  "mercadoPagoStatus",
  "mercadoPagoResponse"
FROM "Subscription"
WHERE "tenantId" = 'tu-tenant-id';
```

El campo `mercadoPagoResponse` contiene el JSON completo de la respuesta de Mercado Pago.

## ⚠️ Problemas Comunes

### 1. Webhook no se recibe

**Solución:**
- Verifica que la URL del webhook esté correctamente configurada en Mercado Pago
- Asegúrate de que el endpoint esté desplegado en producción
- Revisa los logs de Vercel para ver si hay errores

### 2. Suscripción no se actualiza después del pago

**Solución:**
- Verifica que el `external_reference` en Mercado Pago coincida con el `id` de la suscripción
- Revisa los logs del webhook para ver si hay errores
- Verifica que las credenciales de Mercado Pago sean correctas

### 3. Error "Invalid card token"

**Solución:**
- Asegúrate de usar el SDK de Mercado Pago correctamente en el frontend
- Verifica que el `card_token_id` se genere correctamente
- Usa las tarjetas de prueba proporcionadas por Mercado Pago

## 📝 Checklist de Prueba

- [ ] Credenciales de prueba configuradas en Vercel
- [ ] Plan de prueba creado en la base de datos
- [ ] Suscripción creada exitosamente
- [ ] Preapproval creado en Mercado Pago
- [ ] Webhook recibido y procesado
- [ ] Suscripción actualizada a estado `active`
- [ ] Fechas de renovación calculadas correctamente
- [ ] Historial de pagos muestra el pago
- [ ] Cancelación funciona correctamente
- [ ] Logs muestran información correcta

## 🎯 Próximos Pasos

Una vez que las pruebas con credenciales de prueba funcionen:

1. **Cambiar a credenciales de producción** en Vercel
2. **Actualizar la URL del webhook** en Mercado Pago a producción
3. **Probar con un pago real pequeño** antes de lanzar
4. **Configurar alertas** para monitorear webhooks y pagos

## 📚 Recursos Adicionales

- [Documentación de Mercado Pago - Suscripciones](https://www.mercadopago.com.ar/developers/es/docs/subscriptions/landing)
- [Tarjetas de Prueba de Mercado Pago](https://www.mercadopago.com.ar/developers/es/docs/checkout-api/testing)
- [Panel de Mercado Pago Developers](https://www.mercadopago.com.ar/developers/panel)

