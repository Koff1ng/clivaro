# Configuración de Mercado Pago - Sistema de Suscripciones

## ⚠️ Importante

**Mercado Pago está configurado a nivel global de Clivaro.** Los tenants NO tienen acceso a configurar Mercado Pago, ya que los pagos de suscripciones se procesan directamente a Clivaro, no a los tenants.

## Credenciales de Prueba

**Access Token:**
```
APP_USR-99700b5b-40f4-46ec-a382-60eb283980bb
```

**Public Key:**
```
APP_USR-4561942717623499-011518-f2ce1df59b9b223794ea8c1a33d7f391-3136918603
```

## Pasos para Configurar (Super Admin / Vercel)

1. **Ve a Vercel** → Tu proyecto → Settings → Environment Variables

2. **Agrega las siguientes variables de entorno**:
   - **`MERCADOPAGO_ACCESS_TOKEN`**: `APP_USR-99700b5b-40f4-46ec-a382-60eb283980bb`
   - **`MERCADOPAGO_PUBLIC_KEY`**: `APP_USR-4561942717623499-011518-f2ce1df59b9b223794ea8c1a33d7f391-3136918603` (opcional)

3. **Aplica a todos los ambientes** (Production, Preview, Development)

4. **Redeploy** la aplicación para que las variables surtan efecto

## Configurar Webhook (Recomendado)

Para recibir notificaciones de pagos en tiempo real:

1. **Obtén la URL del Webhook**:
   ```
   https://tu-dominio-vercel.com/api/payments/mercadopago/webhook
   ```
   (Reemplaza `tu-dominio-vercel.com` con tu dominio de Vercel)

2. **Ve a tu panel de Mercado Pago**:
   - Accede a: https://www.mercadopago.com.co/developers/panel
   - Ve a: Tu cuenta → Configuración → Webhooks
   - Haz clic en "Agregar URL"
   - Pega la URL del webhook
   - Guarda

## Probar el Pago de Suscripción (Como Tenant)

Una vez configuradas las credenciales en Vercel:

1. **Inicia sesión como tenant** (no como super admin)

2. **Ve a Configuración → Suscripción**

3. Si tienes una suscripción pendiente o expirada, verás el botón **"Pagar Suscripción"**

4. Haz clic en el botón para crear un pago de prueba

5. Serás redirigido a Mercado Pago (modo sandbox)

6. **Usa las tarjetas de prueba de Mercado Pago**:
   - **Tarjeta aprobada**: `5031 7557 3453 0604` (CVV: 123, Fecha: cualquier fecha futura)
   - **Tarjeta rechazada**: `5031 4332 1540 6351` (CVV: 123, Fecha: cualquier fecha futura)

7. Después del pago, serás redirigido de vuelta a la configuración de suscripción

## Notas Importantes

- Estas son credenciales de **PRUEBA** (sandbox)
- No procesarán pagos reales
- Las tarjetas de prueba funcionan solo en el entorno de pruebas
- **Los tenants NO pueden configurar Mercado Pago** - solo pueden pagar sus suscripciones
- Las credenciales se configuran a nivel de Clivaro (super admin) mediante variables de entorno

## Credenciales de Producción

Cuando tengas las credenciales de producción:

1. Ve a **Vercel** → Tu proyecto → Settings → Environment Variables
2. Actualiza `MERCADOPAGO_ACCESS_TOKEN` con el token de producción
3. Actualiza `MERCADOPAGO_PUBLIC_KEY` con la clave pública de producción (opcional)
4. **Redeploy** la aplicación

## Flujo del Sistema

1. **Super Admin** configura las credenciales de Mercado Pago en Vercel (variables de entorno)
2. **Tenant** ve su suscripción en Configuración → Suscripción
3. **Tenant** hace clic en "Pagar Suscripción"
4. Se crea una preferencia de pago usando las credenciales globales de Clivaro
5. **Tenant** es redirigido a Mercado Pago para completar el pago
6. Mercado Pago envía webhook a Clivaro
7. Clivaro actualiza el estado de la suscripción del tenant
8. **Tenant** ve su información de pago actualizada (método de pago, próximo pago)

