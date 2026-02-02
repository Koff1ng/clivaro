import { createHash } from 'crypto'

export interface ElectronicBillingConfig {
  provider: 'FEG' | 'CUSTOM' | 'DIAN_DIRECT'
  apiUrl?: string
  apiKey?: string
  companyNit: string
  companyName: string
  companyAddress: string
  companyPhone: string
  companyEmail: string
  resolutionNumber: string
  resolutionPrefix: string
  resolutionFrom: string
  resolutionTo: string
  resolutionValidFrom: string
  resolutionValidTo: string
  softwareId?: string // Required for DIAN direct
  softwarePin?: string // Required for DIAN direct
  technicalKey?: string // Required for CUFE
  environment?: '1' | '2' // 1: Production, 2: Test
}

export interface InvoiceTaxData {
  taxRateId?: string
  name: string
  rate: number
  baseAmount: number
  taxAmount: number
}

export interface InvoiceData {
  id: string
  number: string
  prefix: string
  consecutive: string
  issueDate: Date
  issueTime?: string // Format HH:mm:ss-05:00
  dueDate?: Date
  typeCode?: string // 01: Factura, 02: Factura de Exportación, etc.
  customer: {
    nit: string
    name: string
    address?: string
    phone?: string
    email?: string
    isCompany?: boolean
    taxLevelCode?: string // e.g., 'R-99-PN'
  }
  items: Array<{
    code: string
    description: string
    quantity: number
    unitPrice: number
    discount: number
    subtotal: number
    taxes: InvoiceTaxData[] // Granular taxes per item
  }>
  taxSummary: InvoiceTaxData[] // Aggregate taxes
  subtotal: number
  discount: number
  tax: number // Grand total of taxes
  total: number
}

export interface ElectronicBillingResponse {
  success: boolean
  cufe?: string
  qrCode?: string
  pdfUrl?: string
  xmlUrl?: string
  status?: 'ACCEPTED' | 'REJECTED' | 'PENDING'
  message?: string
  errors?: string[]
  response?: any
}

/**
 * Calculates the CUFE (Código Único de Factura Electrónica)
 * Formula DIAN: SHA384(NumFac + FecFac + HorFac + ValFac + CodImp1 + ValImp1 + CodImp2 + ValImp2 + CodImp3 + ValImp3 + ValTot + NITEmisor + NITAdquiriente + ClvTec + TipoAmb)
 */
export function calculateCUFE(invoice: InvoiceData, config: ElectronicBillingConfig): string {
  if (!config.technicalKey) {
    return `SIMULATED-CUFE-${invoice.number}`
  }

  // Format values for hash
  const numFac = invoice.number
  const fecFac = invoice.issueDate.toISOString().split('T')[0]
  const horFac = invoice.issueTime || '00:00:00-05:00'

  const valFac = invoice.subtotal.toFixed(2)
  const valTot = invoice.total.toFixed(2)
  const nitEmisor = config.companyNit.split('-')[0] // Only the NIT part
  const nitAdquiriente = invoice.customer.nit.split('-')[0]
  const clvTec = config.technicalKey
  const tipoAmb = config.environment || '2'

  // Extract main taxes (DIAN CUFE requires specific top 3 if present)
  // Usually: 01 (IVA), 04 (Inpuesto al consumo), 03 (ICA) - DIAN uses codes
  // For the simplified CUFE string, we sum totals of specific types
  const iva = invoice.taxSummary.find(t => t.name.toUpperCase().includes('IVA'))?.taxAmount || 0
  const consumption = invoice.taxSummary.find(t => t.name.toUpperCase().includes('CONSUMO'))?.taxAmount || 0
  const other = invoice.taxSummary.reduce((sum, t) => {
    if (!t.name.toUpperCase().includes('IVA') && !t.name.toUpperCase().includes('CONSUMO')) {
      return sum + t.taxAmount
    }
    return sum
  }, 0)

  const cufeString =
    numFac + fecFac + horFac +
    valFac + "01" + iva.toFixed(2) +
    "04" + consumption.toFixed(2) +
    "03" + other.toFixed(2) +
    valTot + nitEmisor + nitAdquiriente + clvTec + tipoAmb

  return createHash('sha384').update(cufeString).digest('hex')
}

/**
 * Enviar factura a facturación electrónica
 */
export async function sendToElectronicBilling(
  invoiceData: InvoiceData,
  config: ElectronicBillingConfig
): Promise<ElectronicBillingResponse> {
  try {
    switch (config.provider) {
      case 'FEG':
        return await sendToFEG(invoiceData, config)
      case 'CUSTOM':
        return await sendToCustomProvider(invoiceData, config)
      case 'DIAN_DIRECT':
        return await sendToDIANDirect(invoiceData, config)
      default:
        throw new Error('Proveedor de facturación electrónica no configurado')
    }
  } catch (error: any) {
    return {
      success: false,
      message: error.message || 'Error al enviar factura',
      errors: [error.message],
    }
  }
}

/**
 * Integración con Facturación Electrónica Gratuita (FEG)
 */
async function sendToFEG(
  invoiceData: InvoiceData,
  config: ElectronicBillingConfig
): Promise<ElectronicBillingResponse> {
  // TODO: Implementar integración con FEG
  // Ejemplo de estructura:
  /*
  const response = await fetch(`${config.apiUrl}/api/invoices`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      issuer: {
        nit: config.companyNit,
        name: config.companyName,
        address: config.companyAddress,
        phone: config.companyPhone,
        email: config.companyEmail,
      },
      receiver: invoiceData.customer,
      invoice: invoiceData,
      resolution: {
        number: config.resolutionNumber,
        prefix: config.resolutionPrefix,
        from: config.resolutionFrom,
        to: config.resolutionTo,
        validFrom: config.resolutionValidFrom,
        validTo: config.resolutionValidTo,
      },
    }),
  })

  const result = await response.json()
  
  return {
    success: result.success || false,
    cufe: result.cufe,
    qrCode: result.qrCode,
    pdfUrl: result.pdfUrl,
    xmlUrl: result.xmlUrl,
    status: result.status,
    message: result.message,
    response: result,
  }
  */

  // Por ahora retorna simulación
  return {
    success: true,
    cufe: `CUFE-FEG-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
    qrCode: `https://catalogo-vpfe-hab.dian.gov.co/document/consultar?trackId=CUFE-FEG-${Date.now()}`,
    status: 'ACCEPTED',
    message: 'Factura enviada exitosamente (simulación FEG)',
  }
}

/**
 * Integración con proveedor personalizado
 */
async function sendToCustomProvider(
  invoiceData: InvoiceData,
  config: ElectronicBillingConfig
): Promise<ElectronicBillingResponse> {
  if (!config.apiUrl || !config.apiKey) {
    throw new Error('API URL y API Key requeridos para proveedor personalizado')
  }

  // TODO: Implementar integración con proveedor personalizado
  // La estructura dependerá del proveedor específico

  return {
    success: false,
    message: 'Proveedor personalizado no implementado',
  }
}

/**
 * Integración directa con DIAN (Facturación Electrónica Gratuita)
 */
async function sendToDIANDirect(
  invoiceData: InvoiceData,
  config: ElectronicBillingConfig
): Promise<ElectronicBillingResponse> {
  // TODO: Implementar integración directa con DIAN
  // Esto requiere certificados digitales y configuración específica

  return {
    success: false,
    message: 'Integración directa con DIAN no implementada',
  }
}

/**
 * Validar datos de factura antes de enviar
 */
export function validateInvoiceData(invoiceData: InvoiceData): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  if (!invoiceData.number) {
    errors.push('Número de factura requerido')
  }

  if (!invoiceData.customer.nit) {
    errors.push('NIT del cliente requerido')
  }

  if (!invoiceData.customer.name) {
    errors.push('Nombre del cliente requerido')
  }

  if (!invoiceData.items || invoiceData.items.length === 0) {
    errors.push('La factura debe tener al menos un producto')
  }

  if (invoiceData.total <= 0) {
    errors.push('El total de la factura debe ser mayor a 0')
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}

