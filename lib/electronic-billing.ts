import { createHash } from 'crypto'
import { FactusClient } from './factus/client'
import type { FactusInvoiceRequest, FactusCustomer, FactusItem } from './factus/types'

export interface ElectronicBillingConfig {
  provider: 'FACTUS'
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
  // Factus Fields
  factusClientId?: string
  factusClientSecret?: string
  factusUsername?: string
  factusPassword?: string
  factusSandbox?: boolean
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
    idType?: string // CC, NIT, etc.
    taxRegime?: string // 'COMMON', 'SIMPLIFIED', 'GRAN_CONTRIBUYENTE'
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
    // Factus is the sole provider
    return await sendToFactus(invoiceData, config)
  } catch (error: any) {
    return {
      success: false,
      message: error.message || 'Error al enviar factura',
      errors: [error.message],
    }
  }
}



async function sendToFactus(
  invoiceData: InvoiceData,
  config: ElectronicBillingConfig
): Promise<ElectronicBillingResponse> {
  if (!config.factusClientId || !config.factusClientSecret || !config.factusUsername || !config.factusPassword) {
    throw new Error('Credenciales de Factus requeridas (Client ID, Client Secret, Usuario, Contraseña)')
  }

  const client = new FactusClient({
    clientId: config.factusClientId,
    clientSecret: config.factusClientSecret,
    username: config.factusUsername,
    password: config.factusPassword,
    sandbox: config.factusSandbox ?? true,
  })

  try {
    // Map customer ID type to Factus identification_document_id
    const idTypeMap: Record<string, number> = {
      'CC': 1,
      'NIT': 6,
      'CE': 2,
      'PA': 7,
      'TI': 3,
      'RC': 11,
      'NUIP': 1,
    }

    const customerIdType = invoiceData.customer.idType || (invoiceData.customer.isCompany ? 'NIT' : 'CC')
    const nitParts = invoiceData.customer.nit.split('-')
    const identificationNumber = nitParts[0]
    const dv = nitParts.length > 1 ? nitParts[1] : undefined

    const factusCustomer: FactusCustomer = {
      identification_document_id: idTypeMap[customerIdType] || 1,
      identification: identificationNumber,
      dv: dv,
      names: invoiceData.customer.name,
      address: invoiceData.customer.address,
      email: invoiceData.customer.email,
      phone: invoiceData.customer.phone,
      legal_organization_id: invoiceData.customer.isCompany ? 1 : 2,
      tribute_id: invoiceData.customer.taxRegime === 'COMMON' ? 1 : 21,
    }

    // Map items to Factus format
    const factusItems: FactusItem[] = invoiceData.items.map(item => {
      // Determine tax rate from item taxes
      const ivaRate = item.taxes.find(t => t.name.toUpperCase().includes('IVA'))?.rate || 0
      const isExcluded = ivaRate === 0 ? 1 : 0

      return {
        code_reference: item.code || 'PROD',
        name: item.description,
        quantity: item.quantity,
        discount_rate: item.discount > 0 ? (item.discount / (item.unitPrice * item.quantity)) * 100 : 0,
        price: item.unitPrice,
        tax_rate: ivaRate,
        unit_measure_id: 70, // "Unidad" by default
        standard_code_id: 1, // UNSPSC
        is_excluded: isExcluded,
        tribute_id: isExcluded ? 21 : 1, // 1 = IVA, 21 = No aplica
      }
    })

    const factusRequest: FactusInvoiceRequest = {
      document: invoiceData.typeCode || '01', // 01 = Factura de Venta
      reference_code: invoiceData.number || `CLV-${Date.now()}`,
      observation: `Factura ${invoiceData.number}`,
      payment_form: 1, // 1 = Contado
      payment_method_code: '10', // 10 = Efectivo
      customer: factusCustomer,
      items: factusItems,
      send_email: !!invoiceData.customer.email,
    }

    console.log('[Factus] Creating invoice with payload:', JSON.stringify(factusRequest, null, 2))
    const factusResponse = await client.createInvoice(factusRequest)

    if (factusResponse.data?.bill) {
      const bill = factusResponse.data.bill
      return {
        success: true,
        cufe: bill.cufe,
        qrCode: bill.qr,
        status: bill.status === 'Validado' ? 'ACCEPTED' : 'PENDING',
        message: `Factura ${bill.number} creada exitosamente en Factus`,
        response: factusResponse,
      }
    }

    return {
      success: true,
      message: factusResponse.message || 'Factura enviada a Factus',
      response: factusResponse,
    }

  } catch (error: any) {
    console.error('[Factus] Error:', error)
    return {
      success: false,
      message: error.message || 'Error al enviar factura a Factus',
      errors: [error.message],
    }
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

