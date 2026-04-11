/**
 * Wompi Payment Gateway Integration
 * https://docs.wompi.co/docs/colombia
 * 
 * Pasarela de pago principal para suscripciones de Clivaro.
 * Maneja: firma de integridad, verificación de webhooks, consultas de transacciones.
 */
import { logger } from './logger'
import crypto from 'crypto'

// ─── Config ───
const WOMPI_PUBLIC_KEY = process.env.WOMPI_PUBLIC_KEY || process.env.NEXT_PUBLIC_WOMPI_PUBLIC_KEY || ''
const WOMPI_PRIVATE_KEY = process.env.WOMPI_PRIVATE_KEY || ''
const WOMPI_EVENTS_SECRET = process.env.WOMPI_EVENTS_SECRET || ''
const WOMPI_INTEGRITY_SECRET = process.env.WOMPI_INTEGRITY_SECRET || ''
const WOMPI_API_URL = process.env.WOMPI_API_URL || 'https://sandbox.wompi.co/v1'

// ─── Types ───
export interface WompiTransaction {
  id: string
  amount_in_cents: number
  reference: string
  customer_email: string
  currency: string
  payment_method_type: string
  status: 'PENDING' | 'APPROVED' | 'DECLINED' | 'VOIDED' | 'ERROR'
  status_message?: string
  redirect_url?: string
  payment_source_id?: number
  payment_link_id?: string
  created_at: string
  finalized_at?: string
}

export interface WompiEvent {
  event: string // 'transaction.updated'
  data: {
    transaction: WompiTransaction
  }
  environment: 'test' | 'prod'
  signature: {
    properties: string[] // ['transaction.id', 'transaction.status', 'transaction.amount_in_cents']
    checksum: string
  }
  timestamp: number
  sent_at: string
}

export interface WompiPaymentSession {
  publicKey: string
  reference: string
  amountInCents: number
  currency: string
  signature: string
  redirectUrl: string
  expirationTime?: string
}

// ─── Core Functions ───

/**
 * Generate a unique payment reference
 * Format: CLIV-{tenantId prefix}-{timestamp}-{random}
 */
export function generateReference(tenantId: string): string {
  const prefix = tenantId.slice(0, 6).toUpperCase()
  const timestamp = Date.now().toString(36).toUpperCase()
  const random = crypto.randomBytes(3).toString('hex').toUpperCase()
  return `CLIV-${prefix}-${timestamp}-${random}`
}

/**
 * Generate SHA256 integrity signature for Wompi Widget/Checkout
 * Concatenation order: reference + amountInCents + currency + [expirationTime] + integritySecret
 * https://docs.wompi.co/docs/colombia/widget-checkout-web/#paso-3-genera-una-firma-de-integridad
 */
export function generateIntegritySignature(
  reference: string,
  amountInCents: number,
  currency: string = 'COP',
  expirationTime?: string
): string {
  let concatenated = `${reference}${amountInCents}${currency}`
  if (expirationTime) {
    concatenated += expirationTime
  }
  concatenated += WOMPI_INTEGRITY_SECRET

  return crypto.createHash('sha256').update(concatenated).digest('hex')
}

/**
 * Verify the signature of a Wompi webhook event
 * https://docs.wompi.co/docs/colombia/eventos/#paso-a-paso-verifica-la-autenticidad-de-un-evento
 */
export function verifyEventSignature(event: WompiEvent): boolean {
  const { signature, timestamp, data } = event

  // Step 1: Concatenate property values in order
  let concatenated = ''
  for (const prop of signature.properties) {
    const value = getNestedValue(data, prop)
    concatenated += String(value)
  }

  // Step 2: Append timestamp
  concatenated += String(timestamp)

  // Step 3: Append events secret
  concatenated += WOMPI_EVENTS_SECRET

  // Step 4: SHA256
  const calculatedChecksum = crypto.createHash('sha256').update(concatenated).digest('hex')

  // Step 5: Compare (case-insensitive)
  return calculatedChecksum.toUpperCase() === signature.checksum.toUpperCase()
}

/**
 * Navigate a nested object using dot-notation path
 */
function getNestedValue(obj: any, path: string): any {
  return path.split('.').reduce((current, key) => current?.[key], obj)
}

/**
 * Get transaction details from Wompi API
 * GET https://sandbox.wompi.co/v1/transactions/{id}
 */
export async function getTransaction(transactionId: string): Promise<WompiTransaction | null> {
  const url = `${WOMPI_API_URL}/transactions/${transactionId}`
  logger.info('[Wompi] getTransaction URL:', url)

  try {
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'Authorization': `Bearer ${WOMPI_PRIVATE_KEY}`,
      },
    })

    if (!response.ok) {
      const errorText = await response.text()
      logger.error(`[Wompi] Error fetching transaction ${transactionId}: ${response.status}`, { responseText: errorText.substring(0, 500) })
      return null
    }

    const result = await response.json()
    logger.info('[Wompi] Transaction result:', JSON.stringify(result.data?.status), result.data?.reference)
    return result.data as WompiTransaction
  } catch (error) {
    logger.error('[Wompi] Error fetching transaction:', error)
    return null
  }
}

/**
 * Search for a transaction by its reference using Wompi API
 * GET https://sandbox.wompi.co/v1/transactions?reference=REF
 */
export async function getTransactionByReference(reference: string): Promise<WompiTransaction | null> {
  const url = `${WOMPI_API_URL}/transactions?reference=${encodeURIComponent(reference)}`
  logger.info('[Wompi] getTransactionByReference URL:', url)

  try {
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'Authorization': `Bearer ${WOMPI_PRIVATE_KEY}`,
      },
    })

    if (!response.ok) {
      const errorText = await response.text()
      logger.error(`[Wompi] Error searching transaction by ref ${reference}: ${response.status}`, { responseText: errorText.substring(0, 500) })
      return null
    }

    const result = await response.json()
    const transactions = result.data || []
    logger.info(`[Wompi] Found ${transactions.length} transactions for ref ${reference}`)

    if (transactions.length === 0) return null

    // Return the most recent transaction for this reference
    const sorted = transactions.sort((a: any, b: any) => 
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )
    const tx = sorted[0]
    logger.info('[Wompi] Best match:', tx.id, tx.status, tx.reference)
    return tx as WompiTransaction
  } catch (error) {
    logger.error('[Wompi] Error searching transaction by reference:', error)
    return null
  }
}

/**
 * Get an acceptance token (required for some payment methods)
 * GET /merchants/{public_key}
 */
export async function getAcceptanceToken(): Promise<string | null> {
  try {
    const response = await fetch(`${WOMPI_API_URL}/merchants/${WOMPI_PUBLIC_KEY}`)
    if (!response.ok) return null
    const result = await response.json()
    return result.data?.presigned_acceptance?.acceptance_token || null
  } catch {
    return null
  }
}

/**
 * Create a payment session with all data needed for the Widget
 */
export function createPaymentSession(
  reference: string,
  amountInCents: number,
  redirectUrl: string,
  currency: string = 'COP'
): WompiPaymentSession {
  const signature = generateIntegritySignature(reference, amountInCents, currency)

  return {
    publicKey: WOMPI_PUBLIC_KEY,
    reference,
    amountInCents,
    currency,
    signature,
    redirectUrl,
  }
}

/**
 * Map Wompi transaction status to internal subscription status.
 * 
 * IMPORTANTE: DECLINED NO cancela la suscripción.
 * Si el usuario ya tenía un plan activo y falla un upgrade,
 * DEBE conservar su plan anterior.
 */
export function mapWompiStatusToSubscription(wompiStatus: string): string {
  switch (wompiStatus) {
    case 'APPROVED':
      return 'active'
    case 'PENDING':
      return 'pending_payment'
    case 'DECLINED':
    case 'VOIDED':
    case 'ERROR':
      // NO cancelar — restaurar al estado anterior si tenía uno
      return 'payment_failed'
    default:
      return 'pending_payment'
  }
}

/**
 * Calcula la fecha de fin de la suscripción basándose en el intervalo del PLAN.
 * Siempre tomar el intervalo del plan que se está pagando, no del plan anterior.
 */
export function calculateEndDate(planInterval: string): Date {
  const endDate = new Date()
  if (planInterval === 'annual') {
    endDate.setDate(endDate.getDate() + 365)
  } else {
    endDate.setDate(endDate.getDate() + 30)
  }
  return endDate
}
