/**
 * Servicio de Nómina Electrónica — YABI
 * =======================================
 * Orquesta la transmisión de documentos de nómina electrónica a la DIAN
 * a través de la API GraphQL de YABI.
 * 
 * Flujo:
 * 1. Payslip interno → mapear a formato YABI
 * 2. Ejecutar mutación `createDocument` en YABI
 * 3. Guardar CUNE + estado DIAN en la BD
 * 4. Consultar estado periódicamente vía `electronicDocument`
 * 
 * @module lib/yabi/payroll-service
 */

import { logger } from '@/lib/logger'
import { yabiGraphQL, isYabiConfigured } from './client'
import {
  type YabiPayrollDocument,
  type YabiPayrollWorker,
  type YabiPayrollEarnings,
  type YabiPayrollDeductions,
  DIAN_DOCUMENT_TYPES,
  CONTRACT_TYPES,
  mapYabiDianState,
} from './types'

// =============================================
// INTERFACES INTERNAS
// =============================================

/** Datos del empleador (empresa) para construir el documento */
export interface EmployerInfo {
  nit: string
  dv: string
  companyName: string
  address?: string
  municipalityCode?: string
  departmentCode?: string
}

/** Payslip enriquecido con datos del empleado (viene de Prisma) */
export interface PayslipWithEmployee {
  id: string
  baseSalary: number
  totalEarnings: number
  totalDeductions: number
  netPay: number
  notes?: string | null
  items: Array<{
    type: string
    concept: string
    code?: string | null
    amount: number
    percentage?: number | null
    units?: number | null
    unitType?: string | null
  }>
  employee: {
    documentType: string
    documentNumber: string
    firstName: string
    lastName: string
    email?: string | null
    address?: string | null
    baseSalary: number
    salaryType: string
    integralSalary?: boolean
    contractType?: string
    workerType?: string
    workerSubType?: string
    municipality?: string | null
    bankName?: string | null
    bankAccountType?: string | null
    bankAccountNumber?: string | null
    paymentMethod?: string | null
    hireDate: Date | string
    riskLevel?: number
  }
}

export interface TransmitResult {
  payslipId: string
  success: boolean
  cune?: string
  yabiUid?: string
  statusDIAN: string
  error?: string
}

// =============================================
// MAPEO: PAYSLIP INTERNO → DOCUMENTO YABI
// =============================================

/**
 * Construye el objeto YabiPayrollWorker desde los datos del empleado.
 */
function buildWorker(emp: PayslipWithEmployee['employee']): YabiPayrollWorker {
  const nameParts = emp.firstName.split(' ')
  return {
    workerType: emp.workerType || '01',
    workerSubType: emp.workerSubType || '00',
    documentType: DIAN_DOCUMENT_TYPES[emp.documentType] || '13',
    documentNumber: emp.documentNumber,
    firstName: nameParts[0],
    otherNames: nameParts.length > 1 ? nameParts.slice(1).join(' ') : undefined,
    lastName: emp.lastName.split(' ')[0],
    secondLastName: emp.lastName.split(' ').length > 1 ? emp.lastName.split(' ').slice(1).join(' ') : undefined,
    integralSalary: emp.integralSalary || false,
    contractType: CONTRACT_TYPES[emp.contractType || 'INDEFINIDO'] || '1',
    salary: emp.baseSalary,
    paymentMethod: emp.paymentMethod || undefined,
    bankName: emp.bankName || undefined,
    bankAccountType: emp.bankAccountType || undefined,
    bankAccountNumber: emp.bankAccountNumber || undefined,
    workplaceCountry: 'CO',
    workplaceMunicipalityCode: emp.municipality || undefined,
  }
}

/**
 * Extrae los devengados del payslip y los mapea al formato YABI.
 */
function buildEarnings(
  payslip: PayslipWithEmployee,
  workedDays: number,
): YabiPayrollEarnings {
  const earningItems = payslip.items.filter(i => i.type === 'EARNING')

  const salaryItem = earningItems.find(i => i.code === 'SAL' || i.concept.toLowerCase().includes('salario'))
  const auxTransItem = earningItems.find(i => i.code === 'AUX_TRANS' || i.concept.toLowerCase().includes('transporte'))

  const earnings: YabiPayrollEarnings = {
    totalEarnings: payslip.totalEarnings,
  }

  if (salaryItem) {
    earnings.salary = {
      workedDays,
      amount: salaryItem.amount,
    }
  }

  if (auxTransItem && auxTransItem.amount > 0) {
    earnings.transportAllowance = auxTransItem.amount
  }

  // Bonificaciones y otros devengados no estándar
  const bonuses = earningItems.filter(i =>
    i.code !== 'SAL' && i.code !== 'AUX_TRANS' &&
    !i.concept.toLowerCase().includes('salario') &&
    !i.concept.toLowerCase().includes('transporte')
  )

  if (bonuses.length > 0) {
    earnings.bonuses = bonuses.map(b => ({
      amount: b.amount,
      description: b.concept,
    }))
  }

  return earnings
}

/**
 * Extrae las deducciones del payslip y las mapea al formato YABI.
 */
function buildDeductions(payslip: PayslipWithEmployee): YabiPayrollDeductions {
  const deductionItems = payslip.items.filter(i => i.type === 'DEDUCTION')

  const deductions: YabiPayrollDeductions = {
    totalDeductions: payslip.totalDeductions,
  }

  // Salud
  const healthItem = deductionItems.find(i => i.code === 'DED_SALUD' || i.concept.toLowerCase().includes('salud'))
  if (healthItem) {
    deductions.health = {
      percentage: healthItem.percentage || 4,
      amount: healthItem.amount,
    }
  }

  // Pensión
  const pensionItem = deductionItems.find(i => i.code === 'DED_PENSION' || i.concept.toLowerCase().includes('pensión'))
  if (pensionItem) {
    deductions.pension = {
      percentage: pensionItem.percentage || 4,
      amount: pensionItem.amount,
    }
  }

  // FSP
  const fspItem = deductionItems.find(i => i.code === 'DED_FSP' || i.concept.toLowerCase().includes('solidaridad'))
  if (fspItem) {
    deductions.pensionSolidarityFund = {
      percentage: fspItem.percentage || 1,
      amount: fspItem.amount,
    }
  }

  // Otros descuentos (libranzas, etc.)
  const otherDeductions = deductionItems.filter(i =>
    !['DED_SALUD', 'DED_PENSION', 'DED_FSP'].includes(i.code || '') &&
    !i.concept.toLowerCase().includes('salud') &&
    !i.concept.toLowerCase().includes('pensión') &&
    !i.concept.toLowerCase().includes('solidaridad')
  )

  if (otherDeductions.length > 0) {
    deductions.otherDeductions = otherDeductions.map(d => ({
      amount: d.amount,
      description: d.concept,
    }))
  }

  return deductions
}

/**
 * Construye el documento completo de nómina electrónica para YABI.
 */
export function buildPayrollDocument(
  payslip: PayslipWithEmployee,
  employer: EmployerInfo,
  periodStart: Date | string,
  periodEnd: Date | string,
  environment: number = 2, // 2 = pruebas por defecto
): YabiPayrollDocument {
  const startDate = new Date(periodStart)
  const endDate = new Date(periodEnd)
  const hireDate = new Date(payslip.employee.hireDate)

  // Calcular días trabajados (máximo 30)
  const diffTime = Math.abs(endDate.getTime() - startDate.getTime())
  const workedDays = Math.min(Math.ceil(diffTime / (1000 * 60 * 60 * 24)), 30)

  return {
    generalInformation: {
      countryCode: 'CO',
      currencyCode: 'COP',
      documentType: 'NominaIndividual',
      environment,
      issueDate: new Date().toISOString().split('T')[0],
      payrollPeriod: workedDays <= 15 ? 'quincenal' : 'mensual',
    },
    employer: {
      nit: employer.nit,
      dv: employer.dv,
      companyName: employer.companyName,
      address: employer.address,
      municipalityCode: employer.municipalityCode,
      departmentCode: employer.departmentCode,
      country: 'CO',
    },
    worker: buildWorker(payslip.employee),
    paymentPeriod: {
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0],
      settlementDate: new Date().toISOString().split('T')[0],
      workedDays,
      hireDate: hireDate.toISOString().split('T')[0],
    },
    earnings: buildEarnings(payslip, workedDays),
    deductions: buildDeductions(payslip),
    notes: payslip.notes ? [payslip.notes] : undefined,
  }
}

// =============================================
// TRANSMISIÓN A YABI
// =============================================

/**
 * Transmite un payslip individual a YABI para su procesamiento DIAN.
 * 
 * @param payslip - Payslip con datos del empleado incluidos
 * @param employer - Datos del empleador
 * @param periodStart - Inicio del período
 * @param periodEnd - Fin del período
 * @returns Resultado con CUNE y estado
 */
export async function transmitPayslip(
  payslip: PayslipWithEmployee,
  employer: EmployerInfo,
  periodStart: Date | string,
  periodEnd: Date | string,
): Promise<TransmitResult> {
  if (!isYabiConfigured()) {
    return {
      payslipId: payslip.id,
      success: false,
      statusDIAN: 'PENDING',
      error: 'YABI no está configurado. Configura YABI_API_URL y YABI_API_TOKEN.',
    }
  }

  try {
    const envNumber = process.env.YABI_ENVIRONMENT === 'production' ? 1 : 2
    const document = buildPayrollDocument(payslip, employer, periodStart, periodEnd, envNumber)

    // Mutation para crear el documento de nómina electrónica
    const mutation = `
      mutation CreatePayrollDocument($input: PayrollDocumentInput!) {
        createPayrollDocument(input: $input) {
          uid
          documentUid
          documentStatus {
            code
            description
          }
          dianState
        }
      }
    `

    const result = await yabiGraphQL<{
      createPayrollDocument: {
        uid: string
        documentUid: string
        documentStatus: { code: number; description: string }
        dianState: number
      }
    }>(mutation, { input: document })

    if (result.errors && result.errors.length > 0) {
      logger.error(`[YABI] Error transmitiendo payslip ${payslip.id}`, {
        errors: result.errors,
      })
      return {
        payslipId: payslip.id,
        success: false,
        statusDIAN: 'REJECTED',
        error: result.errors[0].message,
      }
    }

    const doc = result.data?.createPayrollDocument
    if (!doc) {
      return {
        payslipId: payslip.id,
        success: false,
        statusDIAN: 'PENDING',
        error: 'Respuesta vacía de YABI',
      }
    }

    return {
      payslipId: payslip.id,
      success: true,
      cune: doc.documentUid,
      yabiUid: doc.uid,
      statusDIAN: mapYabiDianState(doc.dianState),
    }
  } catch (error: any) {
    logger.error(`[YABI] Excepción transmitiendo payslip ${payslip.id}`, {
      message: error.message,
    })
    return {
      payslipId: payslip.id,
      success: false,
      statusDIAN: 'PENDING',
      error: error.message,
    }
  }
}

/**
 * Consulta el estado de un documento de nómina en YABI/DIAN.
 * 
 * @param documentUid - UID del documento en YABI (guardado como CUNE en BD)
 * @returns Estado actual del documento
 */
export async function checkDocumentStatus(documentUid: string): Promise<{
  statusDIAN: string
  documentStatus?: { code: number; description: string }
  error?: string
}> {
  if (!isYabiConfigured()) {
    return { statusDIAN: 'PENDING', error: 'YABI no configurado' }
  }

  try {
    const query = `
      query PayrollDocument($uid: UID!) {
        payrollDocument(uid: $uid) {
          uid
          documentUid
          dianState
          documentStatus {
            code
            description
          }
        }
      }
    `

    const result = await yabiGraphQL<{
      payrollDocument: {
        uid: string
        documentUid: string
        dianState: number
        documentStatus: { code: number; description: string }
      }
    }>(query, { uid: documentUid })

    if (result.errors && result.errors.length > 0) {
      return {
        statusDIAN: 'PENDING',
        error: result.errors[0].message,
      }
    }

    const doc = result.data?.payrollDocument
    if (!doc) {
      return { statusDIAN: 'PENDING', error: 'Documento no encontrado en YABI' }
    }

    return {
      statusDIAN: mapYabiDianState(doc.dianState),
      documentStatus: doc.documentStatus,
    }
  } catch (error: any) {
    return {
      statusDIAN: 'PENDING',
      error: error.message,
    }
  }
}
