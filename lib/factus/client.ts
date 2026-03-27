import { logger } from '@/lib/logger'
import type {
  FactusConfig,
  FactusAuthResponse,
  FactusInvoiceRequest,
  FactusInvoiceResponse,
  FactusNumberingRangesResponse,
  FactusMunicipality,
  FactusTribute,
  FactusMeasurementUnit,
} from './types'

/**
 * Factus API Client — Facturación Electrónica Colombia
 * API Docs: https://developers.factus.com.co
 *
 * Handles OAuth2 authentication with auto-refresh,
 * invoice CRUD, PDF/XML download, email, and reference tables.
 */
export class FactusClient {
  private baseUrl: string
  private config: FactusConfig
  private accessToken: string | null = null
  private refreshToken: string | null = null
  private tokenExpiresAt: number = 0

  constructor(config: FactusConfig) {
    this.config = config
    this.baseUrl = config.sandbox
      ? 'https://api-sandbox.factus.com.co'
      : 'https://api.factus.com.co'
  }

  // ============================================
  // AUTH
  // ============================================

  /**
   * Authenticate with Factus OAuth2 (password grant)
   */
  async authenticate(): Promise<void> {
    const formData = new URLSearchParams()
    formData.append('grant_type', 'password')
    formData.append('client_id', this.config.clientId)
    formData.append('client_secret', this.config.clientSecret)
    formData.append('username', this.config.username)
    formData.append('password', this.config.password)

    const startTime = Date.now()

    try {
      const response = await fetch(`${this.baseUrl}/oauth/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: formData.toString(),
      })

      if (!response.ok) {
        const errorBody = await response.text()
        logger.error('[Factus] Auth failed', {
          status: response.status,
          body: errorBody,
          duration: Date.now() - startTime,
        })
        throw new Error(`Factus Auth Error: ${response.status} - ${errorBody}`)
      }

      const data: FactusAuthResponse = await response.json()
      this.accessToken = data.access_token
      this.refreshToken = data.refresh_token
      // Refresh 60s before expiry to be safe
      this.tokenExpiresAt = Date.now() + (data.expires_in - 60) * 1000

      logger.info('[Factus] Authenticated successfully', {
        expiresIn: data.expires_in,
        duration: Date.now() - startTime,
      })
    } catch (error) {
      logger.error('[Factus] Authentication failed', error)
      throw error
    }
  }

  /**
   * Refresh token if expired
   */
  private async ensureAuth(): Promise<void> {
    if (!this.accessToken || Date.now() >= this.tokenExpiresAt) {
      if (this.refreshToken) {
        try {
          await this.refreshAuth()
          return
        } catch {
          // If refresh fails, do full auth
        }
      }
      await this.authenticate()
    }
  }

  /**
   * Refresh using refresh_token grant
   */
  private async refreshAuth(): Promise<void> {
    const formData = new URLSearchParams()
    formData.append('grant_type', 'refresh_token')
    formData.append('client_id', this.config.clientId)
    formData.append('client_secret', this.config.clientSecret)
    formData.append('refresh_token', this.refreshToken!)

    const response = await fetch(`${this.baseUrl}/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formData.toString(),
    })

    if (!response.ok) {
      throw new Error('Token refresh failed')
    }

    const data: FactusAuthResponse = await response.json()
    this.accessToken = data.access_token
    this.refreshToken = data.refresh_token
    this.tokenExpiresAt = Date.now() + (data.expires_in - 60) * 1000

    logger.info('[Factus] Token refreshed successfully')
  }

  // ============================================
  // REQUEST HELPER
  // ============================================

  /**
   * Make authenticated request to Factus API
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    await this.ensureAuth()

    const url = `${this.baseUrl}${endpoint}`
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${this.accessToken}`,
      'Accept': 'application/json',
      ...(options.headers as Record<string, string> || {}),
    }

    if (options.body && typeof options.body === 'string') {
      headers['Content-Type'] = 'application/json'
    }

    const startTime = Date.now()

    try {
      const response = await fetch(url, { ...options, headers })
      const duration = Date.now() - startTime

      if (!response.ok) {
        const errorBody = await response.text()
        logger.error(`[Factus] API Error: ${response.status}`, {
          endpoint,
          status: response.status,
          errorBody,
          duration,
        })
        throw new Error(`Factus API Error: ${response.status} - ${errorBody}`)
      }

      const data = await response.json()
      logger.info(`[Factus] API Success: ${endpoint}`, { duration })
      return data as T
    } catch (error) {
      logger.error(`[Factus] Request failed: ${endpoint}`, error)
      throw error
    }
  }

  /**
   * Make authenticated request that returns raw buffer (for PDF/XML downloads)
   */
  private async requestRaw(endpoint: string): Promise<{ buffer: Buffer; contentType: string }> {
    await this.ensureAuth()

    const url = `${this.baseUrl}${endpoint}`
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Accept': '*/*',
      },
    })

    if (!response.ok) {
      const errorBody = await response.text()
      throw new Error(`Factus Download Error: ${response.status} - ${errorBody}`)
    }

    const arrayBuffer = await response.arrayBuffer()
    return {
      buffer: Buffer.from(arrayBuffer),
      contentType: response.headers.get('content-type') || 'application/octet-stream',
    }
  }

  // ============================================
  // INVOICES (Facturas)
  // ============================================

  /**
   * Create and validate an electronic invoice
   * POST /v1/bills/validate
   */
  async createInvoice(data: FactusInvoiceRequest): Promise<FactusInvoiceResponse> {
    return this.request<FactusInvoiceResponse>('/v1/bills/validate', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  /**
   * Get invoice by number
   * GET /v1/bills/{number}
   */
  async getInvoice(invoiceNumber: string): Promise<FactusInvoiceResponse> {
    return this.request<FactusInvoiceResponse>(`/v1/bills/${invoiceNumber}`)
  }

  /**
   * Download invoice PDF
   * GET /v1/bills/download-pdf/{number}
   */
  async downloadPdf(invoiceNumber: string): Promise<Buffer> {
    const { buffer } = await this.requestRaw(`/v1/bills/download-pdf/${invoiceNumber}`)
    return buffer
  }

  /**
   * Download invoice XML (UBL 2.1)
   * GET /v1/bills/download-xml/{number}
   */
  async downloadXml(invoiceNumber: string): Promise<string> {
    const { buffer } = await this.requestRaw(`/v1/bills/download-xml/${invoiceNumber}`)
    return buffer.toString('utf-8')
  }

  /**
   * Send invoice email to customer
   * POST /v1/bills/send-email/{number}
   */
  async sendEmail(invoiceNumber: string): Promise<any> {
    return this.request(`/v1/bills/send-email/${invoiceNumber}`, {
      method: 'POST',
    })
  }

  /**
   * Delete invoice (only allowed before DIAN validation)
   * DELETE /v1/bills/{number}
   */
  async deleteInvoice(invoiceNumber: string): Promise<any> {
    return this.request(`/v1/bills/${invoiceNumber}`, {
      method: 'DELETE',
    })
  }

  // ============================================
  // NUMBERING RANGES (Rangos de Numeración)
  // ============================================

  /**
   * Get all numbering ranges
   * GET /v1/numbering-ranges
   */
  async getNumberingRanges(): Promise<FactusNumberingRangesResponse> {
    return this.request<FactusNumberingRangesResponse>('/v1/numbering-ranges')
  }

  // ============================================
  // REFERENCE TABLES (Tablas de Referencia)
  // ============================================

  /**
   * Get municipalities catalog
   * GET /v1/municipalities
   */
  async getMunicipalities(): Promise<FactusMunicipality[]> {
    const res = await this.request<{ data: FactusMunicipality[] }>('/v1/municipalities')
    return res.data
  }

  /**
   * Get tributes catalog
   * GET /v1/tributes
   */
  async getTributes(): Promise<FactusTribute[]> {
    const res = await this.request<{ data: FactusTribute[] }>('/v1/tributes')
    return res.data
  }

  /**
   * Get measurement units catalog
   * GET /v1/measurement-units
   */
  async getMeasurementUnits(): Promise<FactusMeasurementUnit[]> {
    const res = await this.request<{ data: FactusMeasurementUnit[] }>('/v1/measurement-units')
    return res.data
  }
}
