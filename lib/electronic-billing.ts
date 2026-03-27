import { createHash } from 'crypto'
import { generateInvoiceXML } from './dian/xml-generator'
import { signXML } from './dian/signer'
import { sendBill } from './dian/client'
import JSZip from 'jszip'
import { AlegraClient } from './alegra/client'
import { FactusClient } from './factus/client'
import type { FactusInvoiceRequest, FactusCustomer, FactusItem } from './factus/types'

export interface ElectronicBillingConfig {
  provider: 'FEG' | 'CUSTOM' | 'DIAN_DIRECT' | 'ALEGRA' | 'FACTUS'
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
  alegraEmail?: string
  alegraToken?: string
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
    switch (config.provider) {
      case 'FEG':
        return await sendToFEG(invoiceData, config)
      case 'CUSTOM':
        return await sendToCustomProvider(invoiceData, config)
      case 'DIAN_DIRECT':
        return await sendToDIANDirect(invoiceData, config)
      case 'ALEGRA':
        return await sendToAlegra(invoiceData, config)
      case 'FACTUS':
        return await sendToFactus(invoiceData, config)
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
 * Integración con Alegra
 */
async function sendToAlegra(
  invoiceData: InvoiceData,
  config: ElectronicBillingConfig
): Promise<ElectronicBillingResponse> {
  if (!config.alegraEmail || !config.alegraToken) {
    throw new Error('Email y Token de Alegra requeridos')
  }

  const alegra = new AlegraClient({
    email: config.alegraEmail,
    token: config.alegraToken
  })

  try {
    // 1. Sync Contact (Get or Create)
    const contacts = await alegra.searchCustomer(invoiceData.customer.nit.split('-')[0])
    let customerId: number

    if (contacts.length > 0) {
      customerId = contacts[0].id
    } else {
      const contactPayload = {
        name: invoiceData.customer.name,
        identification: invoiceData.customer.nit.split('-')[0],
        identificationObject: {
          type: invoiceData.customer.idType || (invoiceData.customer.isCompany ? 'NIT' : 'CC'),
          number: invoiceData.customer.nit.split('-')[0]
        },
        email: invoiceData.customer.email,
        phonePrimary: invoiceData.customer.phone,
        address: {
          address: invoiceData.customer.address
        },
        type: ['client'],
        kindOfPerson: invoiceData.customer.isCompany ? 'LEGAL' : 'PERSON',
        regime: invoiceData.customer.taxRegime === 'COMMON' ? 'COMMON' : 'SIMPLIFIED'
      }
      console.log('[Alegra] Creating customer with payload:', JSON.stringify(contactPayload, null, 2))
      const newContact = await alegra.createCustomer(contactPayload)
      customerId = newContact.id
    }

    // 2. Map Items (Alegra requires an 'id' for each item)
    // We try to fetch active products from Alegra as a fallback
    let alegraProducts = await alegra.getProducts({ limit: 10 })

    // Find first active product
    let activeProduct = alegraProducts.find((p: any) => p.status === 'active')
    let fallbackProductId: string | number

    if (activeProduct) {
      fallbackProductId = activeProduct.id
    } else if (alegraProducts.length > 0) {
      fallbackProductId = alegraProducts[0].id
    } else {
      // Create a dummy product if none exist
      const newProduct = await alegra.createItem({
        name: "Item Genérico",
        price: 100,
        inventory: { unit: "unit" }
      })
      fallbackProductId = (newProduct as any).id
    }

    const items = invoiceData.items.map(item => {
      return {
        id: fallbackProductId, // Use fallback if we don't have a specific mapping yet
        name: item.description,
        price: item.unitPrice,
        quantity: item.quantity,
        discount: item.discount,
        tax: item.taxes.map(t => ({
          id: '1', // Default tax ID in Alegra (usually 19% or generic)
          name: t.name,
          percentage: t.rate
        }))
      }
    })

    // 3. Prepare Invoice Data
    // 3.1 Fetch Numbering Templates to find the electronic one
    const templates = await alegra.getNumberTemplates()
    const electronicTemplate = templates.find((t: any) => t.isElectronic === true || t.isElectronic === 'true')

    // If no electronic template found, we use the default but it might fail for electronic invoicing.
    // However, if we found one, we MUST send it.
    const numberTemplate = electronicTemplate ? { id: electronicTemplate.id } : undefined

    if (!electronicTemplate) {
      console.warn('[Alegra] No electronic numbering template found. Invoice might default to non-electronic.')
    } else {
      console.log('[Alegra] Using electronic template:', electronicTemplate.name)
    }

    // 3.2 Create Invoice Payload
    const invoicePayload = {
      date: invoiceData.issueDate.toISOString().split('T')[0],
      dueDate: invoiceData.dueDate?.toISOString().split('T')[0] || invoiceData.issueDate.toISOString().split('T')[0],
      client: customerId,
      items: items,
      numberTemplate: numberTemplate,
      paymentMethod: 'CASH',
      stamp: {
        generateStamp: true
      }
    }
    console.log('[Alegra] Creating invoice with payload:', JSON.stringify(invoicePayload, null, 2))
    const alegraInvoice = await alegra.createInvoice(invoicePayload)

    return {
      success: true,
      status: alegraInvoice.stamp?.status === 'signed' ? 'ACCEPTED' : 'PENDING',
      message: 'Factura enviada a Alegra',
      response: alegraInvoice,
      cufe: alegraInvoice.stamp?.cufe,
      xmlUrl: alegraInvoice.xml || alegraInvoice.stamp?.xml,
      pdfUrl: alegraInvoice.pdfUrl || alegraInvoice.stamp?.pdf
    }

  } catch (error: any) {
    console.error('Alegra Sync Error:', error)

    let errorMessage = error.message

    // Check for specific known Alegra errors
    if (errorMessage.includes('"code":3051') || errorMessage.includes('La numeración no es válida para facturación electrónica')) {
      errorMessage = 'Alegra rechazó la factura porque no tienes una "Numeración Electrónica" configurada. Ve a Alegra > Configuración > Numeraciones y crea una marcada como "Electrónica".'
    } else if (errorMessage.includes('"code":2035') || errorMessage.includes('tipo de identificación es obligatorio')) {
      errorMessage = 'Alegra requiere un tipo de identificación válido (CC, NIT). Edita el cliente y guárdalo de nuevo.'
    }

    return {
      success: false,
      message: errorMessage
    }
  }
}

/**
 * Integración directa con DIAN (Facturación Electrónica Gratuita)
 */
async function sendToDIANDirect(
  invoiceData: InvoiceData,
  config: ElectronicBillingConfig
): Promise<ElectronicBillingResponse> {
  try {
    // 1. Generate XML (UBL 2.1)
    const xml = generateInvoiceXML(invoiceData, config)

    // 2. Sign XML (XAdES-BES)
    // For now we pass a dummy buffer if no tech key (simulation) or load real one
    // In real app, certificate would come from config (e.g., base64 or path)
    const certificate = Buffer.from('dummy-cert')
    const signedXml = signXML(xml, certificate, config.softwarePin || '')

    // 3. Compress to ZIP
    const zip = new JSZip()
    const xmlFilename = `${config.companyNit.split('-')[0]}${config.resolutionPrefix}${invoiceData.number}.xml`
    zip.file(xmlFilename, signedXml)
    const zipContent = await zip.generateAsync({ type: 'base64' })

    // 4. Send to DIAN
    const response = await sendBill(zipContent, `${xmlFilename}.zip`, config)

    return response

  } catch (error: any) {
    console.error('DIAN Error:', error)
    return {
      success: false,
      message: 'Error en proceso DIAN: ' + error.message
    }
  }
}

/**
 * Integración con Factus (Halltec) - Facturación Electrónica
 */
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

