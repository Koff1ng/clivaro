# Documentación: Sistema de Cotizaciones Multi-tenant Seguro

Esta implementación asegura el aislamiento total de datos y la seguridad de las llaves en el backend.

## Arquitectura de Seguridad
1.  **Aislamiento de Niveles (RLS)**: Cada consulta a la base de datos está protegida por políticas de Row Level Security. Incluso si el frontend envía un `quote_id` erróneo, el backend (Edge Function) verifica la pertenencia mediante una consulta filtrada por `auth.uid()`.
2.  **Resolución de Tenant en Servidor**: El `tenant_id` nunca se confía desde el cliente. La Edge Function lo resuelve consultando la tabla `tenant_users` cruzándola con el JWT del usuario.
3.  **Signed URLs para PDFs**: El almacenamiento en Supabase Storage es privado. Para compartir el PDF fuera del correo, se generan URLs firmadas con expiración corta.
4.  **Audit Logs**: Cada intento de envío queda registrado con el ID del usuario que lo ejecutó y el estado del envío.

## Integración en Frontend

Usa el siguiente código en tu componente de React/Next.js para invocar el envío:

```typescript
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";

export const sendQuotation = async (quoteId: string) => {
  const supabase = createClientComponentClient();
  
  const { data, error } = await supabase.functions.invoke('send-quote-email', {
    body: { quoteId }
  });

  if (error) {
    console.error("Error enviando cotización:", error.message);
    return { success: false, error };
  }

  return { success: true, data };
};
```

## Estructura de Storage
Los archivos se organizan automáticamente:
`quotes/{tenant_id}/{quote_id}.pdf`

La política de RLS de Storage asegura que solo los miembros del tenant con el ID correspondiente en la ruta puedan leer el archivo.
