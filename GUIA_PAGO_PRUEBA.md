# Guía para Realizar un Pago de Prueba

## 🎯 Formulario de Pago Mejorado

El formulario de pago ahora tiene un diseño profesional similar a la imagen proporcionada, con los siguientes campos:

- **Full Name**: Nombre completo del titular de la tarjeta
- **Phone**: Teléfono con selector de código de país (🇨🇴 +57, 🇺🇸 +1, etc.)
- **Email**: Correo electrónico del pagador
- **Card number**: Número de tarjeta (con iconos de tarjetas aceptadas)
- **Expiration date**: Fecha de vencimiento (MM/YY)
- **Security code**: Código de seguridad (CVC)

## 🧪 Cómo Hacer un Pago de Prueba

### 1. Acceder al Formulario de Pago

1. Inicia sesión en tu cuenta de tenant
2. Ve a **Configuración → Suscripción**
3. Si tienes una suscripción pendiente o expirada, verás el botón **"Pagar Suscripción"**
4. O haz clic en **"Manage subscription"** → **"Agregar método de pago"**
5. Selecciona la pestaña **"Tarjeta de Crédito/Débito"**

### 2. Usar Tarjetas de Prueba de Mercado Pago

Mercado Pago proporciona tarjetas de prueba para diferentes escenarios:

#### ✅ Tarjeta Aprobada (Visa)
```
Número: 5031 7557 3453 0604
CVV: 123
Fecha: Cualquier fecha futura (ej: 12/25)
Nombre: Cualquier nombre
```

#### ✅ Tarjeta Aprobada (Mastercard)
```
Número: 5031 4332 1540 6351
CVV: 123
Fecha: Cualquier fecha futura (ej: 12/25)
Nombre: Cualquier nombre
```

#### ❌ Tarjeta Rechazada
```
Número: 5031 4332 1540 6351
CVV: 123
Fecha: Cualquier fecha futura
Nombre: Cualquier nombre
Estado: Será rechazada
```

### 3. Completar el Formulario

1. **Full Name**: Ingresa un nombre (ej: "John Doe")
2. **Phone**: 
   - Selecciona el código de país (🇨🇴 +57 para Colombia)
   - Ingresa un número de teléfono (ej: "8917895190")
3. **Email**: Ingresa un email válido (ej: "test@example.com")
4. **Card number**: Ingresa una de las tarjetas de prueba arriba
5. **Expiration date**: Ingresa una fecha futura (ej: "12/25")
6. **Security code**: Ingresa "123"

### 4. Procesar el Pago

1. Haz clic en el botón **"Pay [monto]"**
2. El sistema procesará el pago usando Checkout API de Mercado Pago
3. Verás un mensaje de éxito o error según el resultado

### 5. Verificar el Resultado

- **Si el pago es exitoso**:
  - Verás un mensaje: "¡Pago procesado exitosamente!"
  - La suscripción se activará automáticamente
  - El historial de pagos se actualizará

- **Si el pago falla**:
  - Verás un mensaje de error explicando la razón
  - Puedes intentar nuevamente con otra tarjeta

## 📋 Checklist de Prueba

- [ ] El formulario se carga correctamente
- [ ] Los campos se muestran con el diseño profesional
- [ ] El selector de código de país funciona
- [ ] Los iconos de tarjetas aparecen al ingresar el número
- [ ] La validación funciona en tiempo real
- [ ] El pago con tarjeta aprobada funciona
- [ ] El pago con tarjeta rechazada muestra error apropiado
- [ ] El historial de pagos se actualiza correctamente
- [ ] La suscripción se activa después del pago exitoso

## 🔍 Verificar en Mercado Pago

Puedes verificar los pagos de prueba en:
- **Sandbox Dashboard**: https://www.mercadopago.com.co/developers/panel/app
- Busca en "Actividad" → "Pagos"
- Los pagos de prueba aparecerán con el estado correspondiente

## ⚠️ Notas Importantes

1. **Credenciales de Prueba**: Asegúrate de estar usando credenciales de prueba (`TEST-` o `APP_USR-`)
2. **Modo Sandbox**: Los pagos se procesan en modo sandbox, no son reales
3. **Webhook**: El webhook recibirá notificaciones de los pagos de prueba
4. **Historial**: Los pagos aparecerán en el historial de pagos de la suscripción

## 🐛 Solución de Problemas

### El formulario no carga
- Verifica que las credenciales de Mercado Pago estén configuradas
- Revisa la consola del navegador para errores
- Asegúrate de que el SDK de Mercado Pago se cargue correctamente

### El pago falla
- Verifica que estés usando una tarjeta de prueba válida
- Revisa los logs del servidor para más detalles
- Asegúrate de que todos los campos requeridos estén completos

### El token no se genera
- Verifica que el número de tarjeta sea válido
- Asegúrate de que la fecha de vencimiento sea futura
- Revisa que el CVV sea correcto

