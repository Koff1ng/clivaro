# Revisión Completa del Sistema de Suscripciones

## Problemas Identificados y Mejoras Necesarias

### 1. **Renovación Automática**
**Problema**: El campo `autoRenew` existe pero no hay lógica que ejecute la renovación automática cuando una suscripción expira.

**Solución**: 
- Crear un endpoint/job que verifique suscripciones expiradas con `autoRenew: true`
- Cuando expire, crear automáticamente una nueva preferencia de pago
- Notificar al usuario que debe pagar para renovar

### 2. **Cálculo de Fechas en Webhook**
**Problema**: En `app/api/payments/mercadopago/webhook/route.ts`, cuando se aprueba un pago:
```typescript
updateData.endDate = subscription.endDate ? 
  new Date(Math.max(new Date(subscription.endDate).getTime(), endDate.getTime())) : 
  endDate
```
Esto puede extender incorrectamente la fecha si ya hay una fecha futura.

**Solución**: 
- Si el pago es aprobado, siempre extender desde la fecha actual o desde `endDate` si es futuro
- Para renovaciones, usar `endDate` actual como base
- Para nuevos pagos, usar fecha actual como base

### 3. **Estados de Suscripción**
**Problema**: No hay lógica automática para marcar suscripciones como `expired` cuando pasa la fecha.

**Solución**: 
- En `app/api/tenant/plan/route.ts`, ya se verifica si está expirada pero no se actualiza el estado
- Agregar lógica para actualizar el estado a `expired` cuando se detecta

### 4. **Pago con Checkout API (Tarjeta Directa)**
**Problema**: En `app/api/subscriptions/payment-method/route.ts`:
```typescript
...(paymentResult.status === 'approved' && subscription.endDate && {
  endDate: new Date(subscription.endDate.getTime() + (subscription.plan.interval === 'monthly' ? 30 : 365) * 24 * 60 * 60 * 1000),
}),
```
Solo extiende si ya existe `endDate`. Si es una nueva suscripción sin `endDate`, no se establece.

**Solución**: 
- Si no hay `endDate`, crear uno desde la fecha actual
- Si hay `endDate` y es futuro, extender desde ahí
- Si hay `endDate` y es pasado, crear uno nuevo desde la fecha actual

### 5. **Validación de Permisos**
**Problema**: Algunos endpoints no validan correctamente que el usuario pertenezca al tenant.

**Solución**: Ya está implementado en la mayoría, pero verificar todos.

### 6. **Manejo de Retry Logic**
**Problema**: Algunos endpoints no tienen retry logic para `MaxClientsInSessionMode`.

**Solución**: Agregar retry logic a todos los endpoints que faltan.

### 7. **Historial de Pagos**
**Problema**: El historial se basa en suscripciones, no en pagos individuales. Si hay múltiples pagos para la misma suscripción, solo se muestra uno.

**Solución**: 
- Considerar crear una tabla `Payment` separada para el historial
- O mejorar la lógica actual para mostrar todos los pagos de una suscripción

### 8. **Sincronización de autoRenew**
**Problema**: El `autoRenew` se guarda en `TenantSettings` pero también en `Subscription`. Puede haber inconsistencia.

**Solución**: 
- Usar `Subscription.autoRenew` como fuente de verdad
- Sincronizar con `TenantSettings` cuando se actualiza

### 9. **Manejo de Pagos Pendientes**
**Problema**: Cuando un pago está pendiente, la suscripción queda en `pending_payment` pero no hay lógica para verificar si el pago se aprobó después.

**Solución**: 
- El webhook debería manejar esto, pero agregar verificación periódica
- O crear un endpoint para verificar el estado de un pago pendiente

### 10. **Validación de Montos**
**Problema**: No se valida que el monto del pago coincida con el precio del plan.

**Solución**: Agregar validación en el webhook y en el procesamiento de pagos.

## Mejoras de Seguridad

1. **Validación de external_reference**: Asegurar que el `external_reference` en Mercado Pago coincida con el `subscriptionId`
2. **Rate limiting**: Agregar rate limiting a endpoints de pago
3. **Logging**: Mejorar logging para auditoría de pagos

## Mejoras de UX

1. **Notificaciones**: Enviar notificaciones cuando:
   - Una suscripción está por expirar
   - Un pago fue aprobado/rechazado
   - Una renovación automática falló

2. **Estados claros**: Mostrar claramente el estado de la suscripción y qué acción necesita el usuario

3. **Reintento de pagos**: Facilitar el reintento de pagos fallidos

