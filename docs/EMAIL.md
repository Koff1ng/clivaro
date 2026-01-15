# Email (SMTP) — Configuración y Troubleshooting

Este documento describe cómo configurar SMTP para envío de emails (ej. cotizaciones/campañas) y cómo diagnosticar problemas comunes.

> Nota de seguridad: **NO** guardes credenciales reales en el repo. Configura todo por variables de entorno.

## Variables de entorno

```env
SMTP_HOST="smtp.tu-proveedor.com"
SMTP_PORT="587"
SMTP_USER="tu-email@dominio.com"
SMTP_PASSWORD="tu-contraseña-o-app-password"
SMTP_FROM="Tu Empresa <noreply@dominio.com>"
SMTP_SECURE="false" # o "true" si usas 465/SSL

# Datos de empresa (opcionales)
COMPANY_NAME="Tu Empresa"
COMPANY_ADDRESS="Dirección"
COMPANY_PHONE="+57 300 000 0000"
COMPANY_EMAIL="contacto@dominio.com"
COMPANY_NIT="900000000-1"
```

## Configuraciones recomendadas por proveedor

### Gmail
- Requiere **contraseña de aplicación** (2FA activado).
- Host: `smtp.gmail.com`
- Puerto: `587` (TLS)

### Outlook / Office365
- Host: `smtp.office365.com`
- Puerto: `587` (TLS)

### Hostinger
- Host: `smtp.hostinger.com`
- Puerto: `465` (SSL) o `587` (TLS)

## Verificación

- Reinicia el servidor después de cambiar `.env`.
- Envía un correo de prueba (si existe endpoint / UI).
- Revisa logs del servidor (ver sección troubleshooting).

## Troubleshooting

### “SMTP not configured”
- Falta alguna variable `SMTP_*` en el entorno.
- Reinicia el servidor.

### “Invalid login / Authentication failed”
- Verifica usuario/contraseña.
- En Gmail, usa contraseña de aplicación (no la contraseña normal).

### “Connection timeout”
- Verifica host/puerto.
- Revisa firewall/red del servidor.
- Prueba alternar `465` vs `587` y `SMTP_SECURE`.

### El sistema dice “enviado” pero no llega
- Revisa SPAM.
- Verifica `accepted/rejected` en la respuesta del transporter.
- Prueba con otro destinatario/dominio.
- Revisa límites de envío del proveedor (cuotas).


