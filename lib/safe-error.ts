/**
 * safe-error.ts
 * Utility to sanitize error messages for API responses in production.
 * Prevents leaking internal database column names, constraint names,
 * Prisma error details, or stack traces to the client.
 */

const INTERNAL_PATTERNS = [
  /column/i,
  /constraint/i,
  /violat(es|ion|ing)/i,
  /prisma/i,
  /P\d{4}/,           // Prisma error codes like P2002, P2025
  /relation/i,
  /schema/i,
  /ECONNREFUSED/,
  /ENOTFOUND/,
  /timeout/i,
  /deadlock/i,
  /transaction/i,
  /connection.*pool/i,
  /connect.*ETIMEDOUT/i,
]

/**
 * Returns a safe error message for client-facing API responses.
 * In development, returns the full error message.
 * In production, strips internal DB details and returns a generic message.
 *
 * @param error - The caught error object
 * @param fallback - The generic message to show in production if the error is internal
 * @returns A string safe to include in JSON responses
 */
export function safeErrorMessage(error: unknown, fallback = 'An internal error occurred'): string {
  const isDev = process.env.NODE_ENV === 'development'

  // Extract message
  let msg = fallback
  if (error instanceof Error) {
    msg = error.message
  } else if (typeof error === 'string') {
    msg = error
  }

  // In development, always return the full message
  if (isDev) return msg

  // In production, check if the message contains internal patterns
  const isInternal = INTERNAL_PATTERNS.some(pattern => pattern.test(msg))
  if (isInternal) return fallback

  // Safe messages pass through (e.g., "User not found", "Invalid email")
  return msg
}

/**
 * Builds a standard error response body.
 * Never includes stack traces in production.
 */
export function safeErrorBody(
  error: unknown,
  fallback = 'An internal error occurred'
): { error: string; details?: string } {
  const isDev = process.env.NODE_ENV === 'development'
  const message = safeErrorMessage(error, fallback)

  if (isDev && error instanceof Error && error.stack) {
    return { error: message, details: error.stack }
  }

  return { error: message }
}
