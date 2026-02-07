import { logger } from '@/lib/logger'

export interface AlegraConfig {
    email: string
    token: string
}

export interface AlegraCompany {
    id: number
    name: string
    identification: string
    email: string
    // ... other fields as per docs
}

export class AlegraClient {
    private baseUrl = 'https://api.alegra.com/api/v1'
    private authHeader: string

    constructor(config: AlegraConfig) {
        const email = config.email.trim()
        const token = config.token.trim()
        const credentials = Buffer.from(`${email}:${token}`).toString('base64')
        this.authHeader = `Basic ${credentials}`
    }

    private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
        const url = `${this.baseUrl}${endpoint}`
        const headers = {
            'Authorization': this.authHeader,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            ...options.headers,
        }

        const startTime = Date.now()
        try {
            const response = await fetch(url, { ...options, headers })
            const duration = Date.now() - startTime

            if (!response.ok) {
                const errorBody = await response.text()
                logger.error(`Alegra API Error: ${response.status} ${response.statusText}`, {
                    endpoint,
                    status: response.status,
                    errorBody,
                    duration,
                })
                throw new Error(`Alegra API Error: ${response.status} ${response.statusText} - ${errorBody}`)
            }

            const data = await response.json()
            logger.info(`Alegra API Success: ${endpoint}`, { duration })
            return data as T
        } catch (error) {
            logger.error(`Alegra Request Failed: ${endpoint}`, error)
            throw error
        }
    }

    /**
     * Preflight: Get Company Info
     */
    async getCompany(): Promise<AlegraCompany> {
        return this.request<AlegraCompany>('/company')
    }

    /**
     * Create Invoice
     */
    async createInvoice(payload: any): Promise<any> {
        return this.request('/invoices', {
            method: 'POST',
            body: JSON.stringify(payload),
        })
    }

    /**
     * Create Credit Note in Alegra
     * Documentation: https://developer.alegra.com/docs/credit-notes
     */
    async createCreditNote(payload: any): Promise<any> {
        try {
            const response = await this.request('/credit-notes', {
                method: 'POST',
                body: JSON.stringify(payload),
            })
            return response
        } catch (error) {
            logger.error('[AlegraClient] Error creating credit note:', error)
            throw error
        }
    }

    /**
     * Get Invoice by ID
     */
    async getInvoice(id: string): Promise<any> {
        return this.request(`/invoices/${id}`)
    }

    /**
     * Search Customer by identification
     */
    async searchCustomer(identification: string): Promise<any[]> {
        return this.request<any[]>(`/contacts?identification=${identification}`)
    }

    /**
     * Create Customer
     */
    async createCustomer(payload: any): Promise<any> {
        logger.info('Alegra: Creating customer', { payload })
        return this.request('/contacts', {
            method: 'POST',
            body: JSON.stringify(payload),
        })
    }

    /**
     * Get Products
     */
    async getProducts(params: { start?: number, limit?: number } = {}): Promise<any[]> {
        const query = new URLSearchParams(params as any).toString()
        return this.request<any[]>(`/items?${query}`)
    }

    /**
     * Create Product/Item
     */
    async createItem(payload: any): Promise<any> {
        return this.request('/items', {
            method: 'POST',
            body: JSON.stringify(payload),
        })
    }

    /**
     * Get Numbering Templates
     */
    async getNumberTemplates(): Promise<any[]> {
        return this.request<any[]>('/number-templates')
    }
}
