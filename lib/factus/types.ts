/**
 * Factus API Types - Facturación Electrónica (Halltec)
 * Docs: https://developers.factus.com.co
 */

// ============================================
// AUTH
// ============================================

export interface FactusAuthRequest {
  grant_type: 'password' | 'refresh_token'
  client_id: string
  client_secret: string
  username?: string
  password?: string
  refresh_token?: string
}

export interface FactusAuthResponse {
  token_type: string
  expires_in: number
  access_token: string
  refresh_token: string
}

// ============================================
// CUSTOMER (Adquiriente)
// ============================================

export interface FactusCustomer {
  /** Tipo de documento: CC, NIT, CE, PA, etc. */
  identification_document_id: number
  /** Número de identificación sin DV */
  identification: string
  /** Dígito de verificación (solo NIT) */
  dv?: string
  /** Nombres completos o Razón Social */
  names: string
  /** Dirección */
  address?: string
  /** Email del cliente */
  email?: string
  /** Teléfono */
  phone?: string
  /** 1 = Persona Jurídica, 2 = Persona Natural */
  legal_organization_id?: number
  /** ID del tributo (ej. 21 = No Responsable de IVA) */
  tribute_id?: number
  /** ID del municipio DIAN */
  municipality_id?: number
}

// ============================================
// ITEMS
// ============================================

export interface FactusItem {
  /** Referencia interna del producto/servicio */
  code_reference: string
  /** Nombre/descripción del item */
  name: string
  /** Cantidad */
  quantity: number
  /** Porcentaje de descuento (0-100) */
  discount_rate: number
  /** Precio unitario antes de impuestos */
  price: number
  /** Porcentaje de impuesto (0, 5, 19) */
  tax_rate: number
  /** ID unidad de medida DIAN (ej. 70 = Unidad, 94 = Unidad) */
  unit_measure_id: number
  /** ID código estándar (ej. 1 = UNSPSC) */
  standard_code_id: number
  /** true si el producto es excluido de IVA */
  is_excluded: number // 0 or 1
  /** ID del tributo del item (ej. 1 = IVA) */
  tribute_id: number
  /** Retenciones por item */
  withholding_taxes?: FactusWithholdingTax[]
}

// ============================================
// WITHHOLDINGS (Retenciones)
// ============================================

export interface FactusWithholdingTax {
  /** Código del tributo de retención */
  code: string
  /** Porcentaje de retención */
  withholding_tax_rate: number
}

// ============================================
// INVOICE REQUEST (Crear/Validar Factura)
// ============================================

export interface FactusInvoiceRequest {
  /** Tipo de documento: "01" = Factura de Venta, "03" = Instrumento de Transmisión */
  document?: string
  /** ID del rango de numeración (requerido si hay más de uno activo) */
  numbering_range_id?: number
  /** Código de referencia interno (opcional) */
  reference_code?: string
  /** Observación/notas de la factura */
  observation?: string
  /** Forma de pago: 1 = Contado, 2 = Crédito */
  payment_form?: number
  /** Fecha de vencimiento para pagos a crédito (YYYY-MM-DD) */
  payment_due_date?: string
  /** Código del método de pago (ej. 10 = Efectivo, 47 = Transferencia) */
  payment_method_code?: string
  /** Tipo de operación (ej. 10 = Estándar) */
  operation_type?: string
  /** Datos del cliente/adquiriente */
  customer: FactusCustomer
  /** Líneas/ítems de la factura */
  items: FactusItem[]
  /** Enviar email al cliente? default: true */
  send_email?: boolean
}

// ============================================
// INVOICE RESPONSE
// ============================================

export interface FactusBillData {
  id: number
  document: {
    code: string
    name: string
  }
  number: string
  reference_code: string | null
  status: string
  send_email: boolean
  qr: string
  cufe: string
  validated: string
  discount_rate: string
  discount: number
  gross_total: number
  taxable_amount: number
  tax_amount: number
  total: number
  observation: string | null
  created_at: string
  payment_form: {
    code: string
    name: string
  }
  payment_method: {
    code: string
    name: string
  } | null
  customer: {
    identification_document_id: number
    identification: string
    dv: string | null
    names: string
    email: string | null
    phone: string | null
    address: string | null
  }
  items: Array<{
    code_reference: string
    name: string
    quantity: number
    discount_rate: number
    discount: number
    gross_price: number
    base_price: number
    tax_rate: number
    tax_amount: number
    price: number
    is_excluded: number
    unit_measure_id: number
    unit_measure: string
  }>
}

export interface FactusInvoiceResponse {
  status: string
  message: string
  data?: {
    bill: FactusBillData
  }
}

// ============================================
// NUMBERING RANGES
// ============================================

export interface FactusNumberingRange {
  id: number
  document: string
  prefix: string
  from: number
  to: number
  current: number
  resolution_number: string
  start_date: string
  end_date: string
  technical_key: string | null
  is_expired: boolean
}

export interface FactusNumberingRangesResponse {
  status: string
  message: string
  data: FactusNumberingRange[]
}

// ============================================
// REFERENCE TABLES
// ============================================

export interface FactusMunicipality {
  id: number
  name: string
  department: string
}

export interface FactusTribute {
  id: number
  name: string
  code: string
}

export interface FactusMeasurementUnit {
  id: number
  name: string
  code: string
}

// ============================================
// CLIENT CONFIG
// ============================================

export interface FactusConfig {
  clientId: string
  clientSecret: string
  username: string
  password: string
  sandbox?: boolean
}
