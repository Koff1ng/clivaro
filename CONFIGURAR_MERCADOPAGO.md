# Configuración de Mercado Pago - Credenciales de Prueba

## Credenciales de Prueba

**Access Token:**
```
APP_USR-99700b5b-40f4-46ec-a382-60eb283980bb
```

**Public Key:**
```
APP_USR-4561942717623499-011518-f2ce1df59b9b223794ea8c1a33d7f391-3136918603
```

## Pasos para Configurar

1. **Inicia sesión** en tu aplicación como tenant (no como super admin)

2. **Ve a Configuración**:
   - Haz clic en tu perfil (esquina superior derecha)
   - Selecciona "Configuración" o ve directamente a `/settings`

3. **Abre la pestaña "Pagos"**:
   - En la página de configuración, busca la pestaña "Pagos" o "Mercado Pago"

4. **Habilita Mercado Pago**:
   - Activa el switch "Habilitar Mercado Pago"

5. **Ingresa las credenciales**:
   - **Access Token**: Pega `APP_USR-99700b5b-40f4-46ec-a382-60eb283980bb`
   - **Public Key**: Pega `APP_USR-4561942717623499-011518-f2ce1df59b9b223794ea8c1a33d7f391-3136918603`

6. **Valida las credenciales**:
   - Haz clic en el botón "Validar" junto al Access Token
   - Deberías ver un mensaje de "Credenciales válidas" en verde

7. **Guarda la configuración**:
   - Haz clic en "Guardar Configuración"

## Configurar Webhook (Opcional para pruebas)

Para recibir notificaciones de pagos en tiempo real:

1. **Copia la URL del Webhook** que aparece en la configuración (algo como):
   ```
   https://tu-dominio.com/api/payments/mercadopago/webhook
   ```

2. **Ve a tu panel de Mercado Pago**:
   - Accede a: https://www.mercadopago.com.co/developers/panel
   - Ve a: Tu cuenta → Configuración → Webhooks
   - Haz clic en "Agregar URL"
   - Pega la URL del webhook
   - Guarda

## Probar el Pago de Suscripción

Una vez configuradas las credenciales:

1. **Ve a Configuración → Suscripción**
2. Si tienes una suscripción pendiente o expirada, verás el botón "Pagar Suscripción"
3. Haz clic en el botón para crear un pago de prueba
4. Serás redirigido a Mercado Pago (modo sandbox)
5. Usa las tarjetas de prueba de Mercado Pago:
   - **Tarjeta aprobada**: `5031 7557 3453 0604` (CVV: 123, Fecha: cualquier fecha futura)
   - **Tarjeta rechazada**: `5031 4332 1540 6351` (CVV: 123, Fecha: cualquier fecha futura)

## Notas Importantes

- Estas son credenciales de **PRUEBA** (sandbox)
- No procesarán pagos reales
- Las tarjetas de prueba funcionan solo en el entorno de pruebas
- Cuando tengas las credenciales de producción, reemplázalas en la misma sección

## Credenciales de Producción

Cuando tengas las credenciales de producción, simplemente:
1. Ve a Configuración → Pagos
2. Reemplaza las credenciales de prueba con las de producción
3. Valida y guarda

