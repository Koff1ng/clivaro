/**
 * Tipos TypeScript para la integración con YABI API (Nómina Electrónica)
 * =====================================================================
 * Define las interfaces para la comunicación con la API GraphQL de YABI.
 * Basado en la documentación oficial: https://developers.yabi.co/
 * 
 * @module lib/yabi/types
 */

// =============================================
// CONFIGURACIÓN
// =============================================

export interface YabiConfig {
  apiUrl: string
  apiToken: string
  environment: 'staging' | 'production'
}

// =============================================
// RESPUESTAS DE LA API
// =============================================

export interface YabiGraphQLResponse<T = any> {
  data?: T
  errors?: YabiError[]
}

export interface YabiError {
  id?: string
  type?: string
  subType?: string
  message: string
  title?: string
  helpText?: string
  language?: string
}

export interface YabiDocumentResponse {
  uid: string
  documentUid: string
  documentType: string
  documentStatus: {
    code: number
    description: string
  }
  dianState: number
  generalInformation: {
    issueDateTime: string
    environment: string
  }
  files?: {
    graphicalRepresentationPdf?: { url: string }
    attachedDocument?: { url: string }
  }
}

export interface YabiTransactionResponse {
  transactionId: string
  transactionStatus: {
    code: string
    description: string
  }
  documentId: string
}

// =============================================
// DOCUMENTO DE NÓMINA ELECTRÓNICA
// =============================================

/**
 * Estructura del Documento Soporte de Pago de Nómina Electrónica
 * Resolución DIAN - Nómina Electrónica Individual
 */
export interface YabiPayrollDocument {
  /** Información general del documento */
  generalInformation: YabiPayrollGeneralInfo
  /** Información del empleador */
  employer: YabiPayrollEmployer
  /** Información del trabajador */
  worker: YabiPayrollWorker
  /** Período de pago */
  paymentPeriod: YabiPayrollPeriod
  /** Devengados */
  earnings: YabiPayrollEarnings
  /** Deducciones */
  deductions: YabiPayrollDeductions
  /** Redondeo (centavos) */
  rounding?: number
  /** Notas */
  notes?: string[]
}

export interface YabiPayrollGeneralInfo {
  /** Código del país (CO) */
  countryCode: string
  /** Moneda (COP) */
  currencyCode: string
  /** Tipo de documento: NominaIndividual, NominaIndividualDeAjuste */
  documentType: 'NominaIndividual' | 'NominaIndividualDeAjuste'
  /** Ambiente: 1 = Producción, 2 = Pruebas */
  environment: number
  /** Fecha de generación (ISO 8601) */
  issueDate: string
  /** Período de nómina: mensual, quincenal, semanal, etc. */
  payrollPeriod: string
}

export interface YabiPayrollEmployer {
  /** NIT del empleador */
  nit: string
  /** DV (dígito de verificación) */
  dv: string
  /** Razón social */
  companyName: string
  /** Dirección */
  address?: string
  /** Código del municipio DIAN */
  municipalityCode?: string
  /** Código del departamento DIAN */
  departmentCode?: string
  /** País */
  country?: string
}

export interface YabiPayrollWorker {
  /** Tipo de trabajador (01=dependiente, 02=independiente, etc.) */
  workerType: string
  /** Subtipo de trabajador (00=no aplica) */
  workerSubType: string
  /** Tipo de documento de identidad */
  documentType: string
  /** Número de documento */
  documentNumber: string
  /** Primer nombre */
  firstName: string
  /** Otros nombres */
  otherNames?: string
  /** Primer apellido */
  lastName: string
  /** Segundo apellido */
  secondLastName?: string
  /** Lugar de trabajo — código municipio */
  workplaceMunicipalityCode?: string
  /** Lugar de trabajo — código departamento */
  workplaceDepartmentCode?: string
  /** Lugar de trabajo — dirección */
  workplaceAddress?: string
  /** Lugar de trabajo — país */
  workplaceCountry?: string
  /** ¿Salario integral? */
  integralSalary: boolean
  /** Tipo de contrato */
  contractType: string
  /** Salario mensual base */
  salary: number
  /** Código del tipo de pago */
  paymentMethod?: string
  /** Entidad bancaria */
  bankName?: string
  /** Tipo de cuenta bancaria */
  bankAccountType?: string
  /** Número de cuenta bancaria */
  bankAccountNumber?: string
}

export interface YabiPayrollPeriod {
  /** Fecha de inicio del período */
  startDate: string
  /** Fecha de fin del período */
  endDate: string
  /** Fecha de liquidación */
  settlementDate: string
  /** Días trabajados */
  workedDays: number
  /** Fecha de ingreso del trabajador */
  hireDate: string
}

export interface YabiPayrollEarnings {
  /** Sueldo trabajado */
  salary?: {
    workedDays: number
    amount: number
  }
  /** Auxilio de transporte */
  transportAllowance?: number
  /** Horas extra diurnas */
  overtimeDaytime?: Array<{
    hours: number
    percentage: number
    amount: number
  }>
  /** Horas extra nocturnas */
  overtimeNighttime?: Array<{
    hours: number
    percentage: number
    amount: number
  }>
  /** Horas extra festivas diurnas */
  overtimeHolidayDaytime?: Array<{
    hours: number
    percentage: number
    amount: number
  }>
  /** Comisiones */
  commissions?: number
  /** Bonificaciones */
  bonuses?: Array<{
    amount: number
    description?: string
  }>
  /** Vacaciones disfrutadas */
  vacations?: {
    days: number
    amount: number
  }
  /** Prima */
  servicePremium?: {
    workedDays: number
    amount: number
  }
  /** Cesantías */
  severancePay?: {
    amount: number
    percentage: number
  }
  /** Intereses de cesantías */
  severanceInterest?: {
    amount: number
    percentage: number
  }
  /** Incapacidades */
  disabilities?: Array<{
    type: string
    days: number
    amount: number
  }>
  /** Total devengados */
  totalEarnings: number
}

export interface YabiPayrollDeductions {
  /** Salud empleado */
  health?: {
    percentage: number
    amount: number
  }
  /** Pensión empleado */
  pension?: {
    percentage: number
    amount: number
  }
  /** Fondo de solidaridad pensional */
  pensionSolidarityFund?: {
    percentage: number
    amount: number
  }
  /** Fondo de subsistencia */
  subsistenceFund?: {
    percentage: number
    amount: number
  }
  /** Retención en la fuente */
  withholdingTax?: number
  /** Libranzas */
  loans?: Array<{
    description: string
    amount: number
  }>
  /** Sindicatos */
  unions?: Array<{
    percentage: number
    amount: number
  }>
  /** Sanciones */
  penalties?: Array<{
    amount: number
    description?: string
  }>
  /** Otros descuentos */
  otherDeductions?: Array<{
    amount: number
    description?: string
  }>
  /** Total deducciones */
  totalDeductions: number
}

// =============================================
// NOTA DE AJUSTE DE NÓMINA
// =============================================

export interface YabiPayrollAdjustmentNote {
  /** Tipo: NominaIndividualDeAjuste */
  documentType: 'NominaIndividualDeAjuste'
  /** Referencia al documento original (CUNE) */
  referenceCune: string
  /** Tipo de nota: REPLACE = Reemplazo, DELETE = Eliminación */
  adjustmentType: 'REPLACE' | 'DELETE'
  /** Documento de reemplazo (solo si adjustmentType === 'REPLACE') */
  replacementDocument?: YabiPayrollDocument
}

// =============================================
// ESTADOS DEL DOCUMENTO
// =============================================

export enum YabiDocumentStatus {
  /** Procesando en YABI */
  PROCESSING = 'PROCESSING',
  /** Enviado a la DIAN */
  SENT_TO_DIAN = 'SENT_TO_DIAN',
  /** Aceptado por la DIAN */
  DIAN_ACCEPTED = 'DIAN_ACCEPTED',
  /** Rechazado por la DIAN */
  DIAN_REJECTED = 'DIAN_REJECTED',
  /** Error en el procesamiento */
  ERROR = 'ERROR',
}

/**
 * Mapea el dianState numérico de YABI a nuestro estado interno.
 * Los valores numéricos vienen de la referencia YABI:
 * - 0: En proceso
 * - 1: Aceptado
 * - 2: Rechazado
 * - 3: Error
 */
export function mapYabiDianState(dianState: number): string {
  switch (dianState) {
    case 0: return 'SENT'
    case 1: return 'ACCEPTED'
    case 2: return 'REJECTED'
    default: return 'PENDING'
  }
}

// =============================================
// MAPEO DE TIPOS DE DOCUMENTO DIAN
// =============================================

/** Tipos de documento de identidad según DIAN */
export const DIAN_DOCUMENT_TYPES: Record<string, string> = {
  'CC': '13',   // Cédula de Ciudadanía
  'CE': '22',   // Cédula de Extranjería
  'TI': '12',   // Tarjeta de Identidad
  'PP': '41',   // Pasaporte
  'NIT': '31',  // NIT
  'RC': '11',   // Registro Civil
  'PEP': '47',  // Permiso Especial de Permanencia
}

/** Tipos de contrato para nómina electrónica */
export const CONTRACT_TYPES: Record<string, string> = {
  'INDEFINIDO': '1',        // Término indefinido
  'FIJO': '2',              // Término fijo
  'OBRA_LABOR': '3',        // Obra o labor
  'APRENDIZAJE': '4',       // Aprendizaje
  'PRESTACION_SERVICIOS': '5', // Prestación de servicios
}
