/**
 * Helpers para recuperación de contraseña (usuarios en schema tenant_*).
 */
import { logger } from './logger'
import { createHash, randomBytes } from 'crypto'
import { Client } from 'pg'
import { getSchemaName } from '@/lib/tenant-utils'
import { isSmtpConfigured } from '@/lib/email'

function getDirectPostgresUrl(): string {
  const base = process.env.DIRECT_URL || process.env.DATABASE_URL || ''
  try {
    const url = new URL(base)
    url.searchParams.delete('schema')
    url.searchParams.delete('pgbouncer')
    url.searchParams.delete('connect_timeout')
    return url.toString()
  } catch {
    return base
  }
}

export function hashResetToken(rawToken: string): string {
  return createHash('sha256').update(rawToken, 'utf8').digest('hex')
}

export function generateResetToken(): string {
  return randomBytes(32).toString('hex')
}

export type TenantUserForReset = {
  id: string
  email: string | null
  username: string
  name: string
}

/**
 * Busca usuario activo por usuario o correo (misma lógica que el login).
 * Solo sirve para enviar correo si hay email.
 */
export async function findTenantUserForPasswordReset(
  tenantId: string,
  identifier: string
): Promise<TenantUserForReset | null> {
  const schemaName = getSchemaName(tenantId)
  const connString = getDirectPostgresUrl()
  const client = new Client({
    connectionString: connString,
    ssl: connString.includes('supabase') || connString.includes('localhost') ? false : { rejectUnauthorized: false },
  })

  const trimmed = identifier.trim()
  if (!trimmed) return null

  try {
    await client.connect()
    await client.query(`SET search_path TO "${schemaName}", public`)

    const result = await client.query<TenantUserForReset>(
      `SELECT id, email, username, name
       FROM "User"
       WHERE active = true
         AND (
           LOWER(username) = LOWER($1)
           OR (email IS NOT NULL AND LOWER(TRIM(email)) = LOWER(TRIM($1)))
         )
       LIMIT 1`,
      [trimmed]
    )

    if (result.rows.length === 0) return null
    return result.rows[0]
  } finally {
    await client.end().catch(() => {})
  }
}

/** SMTP en Vercel: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD (+ SMTP_FROM recomendado como remitente). */
export function getPasswordResetEmailConfigured(): boolean {
  return !!(process.env.RESEND_API_KEY || isSmtpConfigured())
}

export function buildPasswordResetUrl(tenantSlug: string, rawToken: string): string {
  const base =
    process.env.NEXTAUTH_URL?.replace(/\/$/, '') ||
    process.env.VERCEL_URL?.replace(/\/$/, '') ||
    ''
  if (!base) {
    logger.warn('[password-reset] NEXTAUTH_URL no definido; el enlace del correo puede ser inválido')
  }
  const origin = base.startsWith('http') ? base : `https://${base}`
  return `${origin}/login/${encodeURIComponent(tenantSlug)}/reset-password?token=${encodeURIComponent(rawToken)}`
}
