import { getTenantPrismaClient } from "./tenancy";

export interface AlegraConfig {
  email: string;
  token: string;
}

export class AlegraService {
  private baseUrl = "https://api.alegra.com/api/v1";
  private auth: string;

  constructor(config: AlegraConfig) {
    this.auth = Buffer.from(`${config.email}:${config.token}`).toString("base64");
  }

  private async request(endpoint: string, options: RequestInit = {}) {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers: {
        Authorization: `Basic ${this.auth}`,
        Content_Type: "application/json",
        Accept: "application/json",
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || `Alegra API Error: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Sync a local customer to Alegra
   */
  async createContact(contact: {
    name: string;
    identification: string;
    email?: string;
    phone?: string;
    address?: string;
  }) {
    return this.request("/contacts", {
      method: "POST",
      body: JSON.stringify({
        name: contact.name,
        identification: contact.identification,
        email: contact.email,
        phonePrimary: contact.phone,
        address: {
          address: contact.address
        },
        type: ["client"]
      }),
    });
  }

  /**
   * Get an invoice by ID
   */
  async getInvoice(invoiceId: string) {
    return this.request(`/invoices/${invoiceId}`);
  }

  /**
   * Create an electronic invoice in Alegra
   */
  async createInvoice(invoiceData: any) {
    return this.request("/invoices", {
      method: "POST",
      body: JSON.stringify(invoiceData),
    });
  }

  /**
   * Create a credit note in Alegra
   */
  async createCreditNote(creditNoteData: any) {
    return this.request("/credit-notes", {
      method: "POST",
      body: JSON.stringify(creditNoteData),
    });
  }

  /**
   * Get PDF binary for an invoice
   */
  async getInvoicePDF(invoiceId: string) {
    // Note: Alegra PDF usually returns a URL or binary depending on headers
    return this.request(`/invoices/${invoiceId}/pdf`);
  }
}

/**
 * Factory to get AlegraService for a specific tenant
 */
export async function getAlegraService(tenantId: string) {
  const prisma = await getTenantPrismaClient(tenantId);
  const config = await prisma.restaurantConfig.findUnique({
    where: { tenantId }
  });

  if (!config || !config.alegraEmail || !config.alegraToken || !config.alegraEnabled) {
    throw new Error("Alegra integration is not configured or disabled for this tenant");
  }

  return new AlegraService({
    email: config.alegraEmail,
    token: config.alegraToken
  });
}
