/**
 * Meta Ads Error Handler
 * Maps Meta API errors to user-friendly Spanish messages.
 * Structures errors for Sentry reporting without exposing stack traces.
 */

// Known Meta API error codes → user-friendly messages
const META_ERROR_MAP: Record<number, string> = {
  // Authentication
  190: 'Tu conexión con Meta ha expirado. Reconecta tu cuenta desde Configuración → Meta Ads.',
  102: 'La sesión de Meta ha expirado. Por favor, vuelve a conectar tu cuenta.',
  
  // Permissions  
  10: 'No tienes permisos suficientes para publicar anuncios. Verifica los permisos de tu cuenta de Meta.',
  200: 'No tienes permiso para realizar esta acción en Meta. Verifica que tu cuenta tenga acceso a la cuenta publicitaria.',
  294: 'Tu aplicación necesita aprobación para gestionar anuncios. Contacta soporte.',
  
  // Ad Policy
  1487851: 'Tu anuncio fue rechazado por las políticas de publicidad de Meta. Revisa el contenido y vuelve a intentar.',
  1487930: 'El contenido del anuncio no cumple con las políticas de Meta. Modifica el texto o la imagen.',
  
  // Payment
  2446: 'No hay un método de pago válido en la cuenta publicitaria de Meta.',
  1815637: 'La cuenta publicitaria tiene pagos pendientes. Resuelve los pagos en Meta Ads Manager.',
  
  // Rate Limiting
  4: 'Demasiadas solicitudes a Meta. Espera unos minutos e intenta de nuevo.',
  17: 'Límite de frecuencia alcanzado. Intenta de nuevo en unos minutos.',
  32: 'Límite de llamadas a la API alcanzado. Espera e intenta más tarde.',
  
  // Account Issues
  1487236: 'La cuenta publicitaria está desactivada. Actívala desde Meta Business Suite.',
  1487690: 'La cuenta publicitaria ha alcanzado su límite de gasto.',
  100: 'Datos inválidos enviados a Meta. Verifica los campos del anuncio.',
}

// Fallback generic message
const GENERIC_ERROR = 'Error al comunicarse con Meta. Por favor, intenta de nuevo más tarde.'

export interface MetaFormattedError {
  userMessage: string
  code: number | null
  subcode: number | null
  type: string | null
  raw: string // for Sentry, never exposed to frontend
}

/**
 * Formats a Meta API error into a structured, user-friendly object.
 */
export function formatMetaError(error: any): MetaFormattedError {
  // Meta SDK errors have a specific structure
  const metaBody = error?.response?.error || error?.body?.error || error?.error || {}
  
  const code = metaBody.code || null
  const subcode = metaBody.error_subcode || null
  const type = metaBody.type || null
  const rawMessage = metaBody.message || error?.message || 'Unknown Meta API error'
  
  // Try to find user-friendly message by code, then subcode
  let userMessage = GENERIC_ERROR
  if (subcode && META_ERROR_MAP[subcode]) {
    userMessage = META_ERROR_MAP[subcode]
  } else if (code && META_ERROR_MAP[code]) {
    userMessage = META_ERROR_MAP[code]
  }
  
  return {
    userMessage,
    code,
    subcode,
    type,
    raw: rawMessage, // only for logging/Sentry
  }
}

/**
 * Checks if the error is a token expiry issue.
 */
export function isTokenExpired(error: any): boolean {
  const metaBody = error?.response?.error || error?.body?.error || error?.error || {}
  return metaBody.code === 190 || metaBody.code === 102
}

/**
 * Creates a structured error payload for Sentry.
 */
export function buildSentryPayload(tenantId: string, action: string, formatted: MetaFormattedError) {
  return {
    tags: {
      module: 'meta-ads',
      action,
      metaErrorCode: String(formatted.code || 'unknown'),
      metaErrorType: formatted.type || 'unknown',
    },
    extra: {
      tenantId,
      userMessage: formatted.userMessage,
      rawError: formatted.raw,
      subcode: formatted.subcode,
    },
  }
}
