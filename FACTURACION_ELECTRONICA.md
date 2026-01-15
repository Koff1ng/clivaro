# Facturación Electrónica DIAN - Guía de Configuración

## 📋 Descripción

Este sistema incluye soporte para facturación electrónica según los estándares de la DIAN (Dirección de Impuestos y Aduanas Nacionales) de Colombia.

## 🔧 Configuración

### Variables de Entorno

Agrega estas variables a tu archivo `.env`:

```env
# Proveedor de Facturación Electrónica
ELECTRONIC_BILLING_PROVIDER=FEG  # Opciones: FEG, CUSTOM, DIAN_DIRECT

# Si usas proveedor personalizado
ELECTRONIC_BILLING_API_URL=https://api.tu-proveedor.com
ELECTRONIC_BILLING_API_KEY=tu-api-key

# Datos de la Empresa
COMPANY_NIT=900000000-1
COMPANY_NAME=Nombre de tu Empresa
COMPANY_ADDRESS=Dirección completa
COMPANY_PHONE=+57 300 123 4567
COMPANY_EMAIL=facturacion@tuempresa.com

# Resolución de Facturación
BILLING_RESOLUTION_NUMBER=12345678901234
BILLING_RESOLUTION_PREFIX=FV
BILLING_RESOLUTION_FROM=1
BILLING_RESOLUTION_TO=999999
BILLING_RESOLUTION_VALID_FROM=2024-01-01
BILLING_RESOLUTION_VALID_TO=2024-12-31
```

## 📦 Proveedores Soportados

### 1. Facturación Electrónica Gratuita (FEG)
- Proveedor oficial de la DIAN
- Gratuito para empresas pequeñas
- Requiere registro en el portal de la DIAN

### 2. Proveedor Personalizado
- Integración con cualquier proveedor autorizado
- Requiere API URL y API Key
- Implementar función `sendToCustomProvider` en `lib/electronic-billing.ts`

### 3. Integración Directa con DIAN
- Requiere certificados digitales
- Configuración avanzada
- Implementar función `sendToDIANDirect` en `lib/electronic-billing.ts`

## 🚀 Uso

### Enviar Factura a Facturación Electrónica

1. Ve a **Ventas > Facturas**
2. Busca la factura que deseas enviar
3. Haz clic en el botón de **Facturación Electrónica** (ícono QR)
4. La factura se enviará al proveedor configurado
5. Se generará el CUFE y código QR automáticamente

### Campos de Factura Electrónica

- **CUFE**: Código Único de Factura Electrónica
- **QR Code**: Código QR para validación en DIAN
- **Estado**: Pendiente, Enviada, Aceptada, Rechazada
- **Resolución**: Número de resolución de facturación

## 📝 Implementación de Proveedor

Para implementar un proveedor personalizado, edita `lib/electronic-billing.ts`:

```typescript
async function sendToCustomProvider(
  invoiceData: InvoiceData,
  config: ElectronicBillingConfig
): Promise<ElectronicBillingResponse> {
  const response = await fetch(`${config.apiUrl}/api/invoices`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      // Estructura según tu proveedor
    }),
  })

  const result = await response.json()
  
  return {
    success: result.success,
    cufe: result.cufe,
    qrCode: result.qrCode,
    pdfUrl: result.pdfUrl,
    xmlUrl: result.xmlUrl,
    status: result.status,
    message: result.message,
  }
}
```

## ✅ Validaciones

El sistema valida automáticamente:
- Número de factura
- NIT del cliente
- Nombre del cliente
- Productos en la factura
- Total mayor a 0

## 🔗 Enlaces Útiles

- [Portal DIAN](https://www.dian.gov.co/)
- [Facturación Electrónica Gratuita](https://facturaelectronica.dian.gov.co/)
- [Catálogo de Proveedores](https://www.dian.gov.co/factura-electronica)

## ⚠️ Nota Importante

La implementación actual incluye una **simulación** para desarrollo. Para producción, debes:

1. Configurar un proveedor real
2. Obtener credenciales de la DIAN
3. Configurar resolución de facturación
4. Implementar la integración real en `lib/electronic-billing.ts`

