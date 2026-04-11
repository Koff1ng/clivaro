/**
 * Motor de Cálculos de Nómina Electrónica — Colombia
 * ===================================================
 * Implementa todas las reglas de nómina colombiana vigentes (2025).
 * 
 * Referencia legal:
 * - Ley 100 de 1993 (Sistema de Seguridad Social)
 * - Ley 1607 de 2012, Ley 1819 de 2016 (Aportes parafiscales)
 * - Decreto 2616 de 2013 (Cotización por semanas)
 * - Resolución DIAN para Nómina Electrónica
 * 
 * @module lib/payroll/calculations
 */

// =============================================
// CONSTANTES LEGALES 2025
// =============================================

/** Salario Mínimo Legal Mensual Vigente 2025 */
export const SMLMV_2025 = 1_423_500

/** Auxilio de Transporte 2025 */
export const AUXILIO_TRANSPORTE_2025 = 200_000

/** Tope para auxilio de transporte: 2 SMLMV */
export const TOPE_AUX_TRANSPORTE = 2

/** Tope para Fondo de Solidaridad Pensional: 4 SMLMV */
export const TOPE_FSP = 4

// --- Porcentajes de Seguridad Social ---

/** Salud — Aporte del empleado */
export const PCT_SALUD_EMPLEADO = 0.04

/** Salud — Aporte del empleador */
export const PCT_SALUD_EMPLEADOR = 0.085

/** Pensión — Aporte del empleado */
export const PCT_PENSION_EMPLEADO = 0.04

/** Pensión — Aporte del empleador */
export const PCT_PENSION_EMPLEADOR = 0.12

/** Fondo de Solidaridad Pensional — aplica si salario > 4 SMLMV */
export const PCT_FSP = 0.01

// --- Porcentajes de ARL (Riesgo) ---
/** 
 * Niveles de riesgo ARL según actividad económica.
 * Nivel I (0.522%) — Administrativos, oficinas
 * Nivel II (1.044%) — Comercio, servicios generales
 * Nivel III (2.436%) — Manufactura liviana
 * Nivel IV (4.350%) — Construcción, minería ligera
 * Nivel V (6.960%) — Alto riesgo (minería, explosivos)
 */
export const ARL_RATES: Record<number, number> = {
  1: 0.00522,
  2: 0.01044,
  3: 0.02436,
  4: 0.04350,
  5: 0.06960,
}

// --- Aportes Parafiscales (100% empleador) ---

/** Caja de Compensación Familiar */
export const PCT_CCF = 0.04

/** ICBF — Solo aplica si empresa no está exonerada (Ley 1607) */
export const PCT_ICBF = 0.03

/** SENA — Solo aplica si empresa no está exonerada (Ley 1607) */
export const PCT_SENA = 0.02

// =============================================
// INTERFACES
// =============================================

export interface PayrollEmployeeInput {
  baseSalary: number
  salaryType: string       // 'FIJO' | 'VARIABLE' | 'INTEGRAL'
  riskLevel: number        // 1-5 (ARL)
  integralSalary: boolean  // ¿Salario integral?
  workedDays?: number      // Días trabajados en el período (default 30)
}

export interface PayrollCalculationResult {
  /** Items de devengados (se pagan al empleado) */
  earnings: PayrollItem[]
  /** Items de deducciones (se descuentan al empleado) */
  deductions: PayrollItem[]
  /** Aportes patronales (los paga el empleador, NO se descuentan al empleado) */
  employerContributions: PayrollItem[]
  /** Totales */
  totalEarnings: number
  totalDeductions: number
  netPay: number
  totalEmployerCost: number
}

export interface PayrollItem {
  concept: string
  code: string        // Código DIAN para nómina electrónica
  amount: number
  percentage?: number
  type: 'EARNING' | 'DEDUCTION' | 'EMPLOYER'
  isAutomatic: boolean
}

// =============================================
// FUNCIONES DE CÁLCULO
// =============================================

/**
 * Redondea al peso colombiano más cercano (sin decimales).
 */
function roundCOP(value: number): number {
  return Math.round(value)
}

/**
 * Calcula si el empleado tiene derecho a auxilio de transporte.
 * Aplica si el salario base es ≤ 2 SMLMV y NO es salario integral.
 */
export function hasTransportAllowance(baseSalary: number, integralSalary: boolean): boolean {
  return !integralSalary && baseSalary <= (SMLMV_2025 * TOPE_AUX_TRANSPORTE)
}

/**
 * Calcula el IBC (Ingreso Base de Cotización).
 * Para salario integral: 70% del salario total.
 * Para salario normal: salario base (sin auxilio transporte).
 */
export function calculateIBC(baseSalary: number, integralSalary: boolean): number {
  if (integralSalary) {
    return roundCOP(baseSalary * 0.70)
  }
  return baseSalary
}

/**
 * Calcula la nómina completa de un empleado para un período.
 * 
 * @param input - Datos del empleado
 * @returns Resultado con devengados, deducciones y aportes patronales
 * 
 * @example
 * ```ts
 * const result = calculatePayroll({
 *   baseSalary: 2_000_000,
 *   salaryType: 'FIJO',
 *   riskLevel: 1,
 *   integralSalary: false,
 *   workedDays: 30,
 * })
 * ```
 */
export function calculatePayroll(input: PayrollEmployeeInput): PayrollCalculationResult {
  const {
    baseSalary,
    integralSalary = false,
    riskLevel = 1,
    workedDays = 30,
  } = input

  const earnings: PayrollItem[] = []
  const deductions: PayrollItem[] = []
  const employerContributions: PayrollItem[] = []

  // --- Factor de proporcionalidad por días trabajados ---
  const daysFactor = workedDays / 30

  // --- 1. DEVENGADOS ---

  // Salario base proporcional
  const salaryAmount = roundCOP(baseSalary * daysFactor)
  earnings.push({
    concept: 'Salario Base',
    code: 'SAL',
    amount: salaryAmount,
    type: 'EARNING',
    isAutomatic: true,
  })

  // Auxilio de transporte (si aplica)
  const auxTransporte = hasTransportAllowance(baseSalary, integralSalary)
    ? roundCOP(AUXILIO_TRANSPORTE_2025 * daysFactor)
    : 0

  if (auxTransporte > 0) {
    earnings.push({
      concept: 'Auxilio de Transporte',
      code: 'AUX_TRANS',
      amount: auxTransporte,
      type: 'EARNING',
      isAutomatic: true,
    })
  }

  // --- 2. DEDUCCIONES AL EMPLEADO ---

  // IBC para seguridad social (SIN auxilio transporte)
  const ibc = calculateIBC(baseSalary, integralSalary) * daysFactor

  // Salud empleado (4%)
  const saludEmpleado = roundCOP(ibc * PCT_SALUD_EMPLEADO)
  deductions.push({
    concept: 'Salud (4%)',
    code: 'DED_SALUD',
    amount: saludEmpleado,
    percentage: PCT_SALUD_EMPLEADO * 100,
    type: 'DEDUCTION',
    isAutomatic: true,
  })

  // Pensión empleado (4%)
  const pensionEmpleado = roundCOP(ibc * PCT_PENSION_EMPLEADO)
  deductions.push({
    concept: 'Pensión (4%)',
    code: 'DED_PENSION',
    amount: pensionEmpleado,
    percentage: PCT_PENSION_EMPLEADO * 100,
    type: 'DEDUCTION',
    isAutomatic: true,
  })

  // Fondo de Solidaridad Pensional (1%) — Solo si salario > 4 SMLMV
  if (baseSalary > (SMLMV_2025 * TOPE_FSP)) {
    const fsp = roundCOP(ibc * PCT_FSP)
    deductions.push({
      concept: 'Fondo Solidaridad Pensional (1%)',
      code: 'DED_FSP',
      amount: fsp,
      percentage: PCT_FSP * 100,
      type: 'DEDUCTION',
      isAutomatic: true,
    })
  }

  // --- 3. APORTES PATRONALES (NO se descuentan al empleado) ---

  // Salud empleador (8.5%)
  const saludEmpleador = roundCOP(ibc * PCT_SALUD_EMPLEADOR)
  employerContributions.push({
    concept: 'Salud Empleador (8.5%)',
    code: 'EMP_SALUD',
    amount: saludEmpleador,
    percentage: PCT_SALUD_EMPLEADOR * 100,
    type: 'EMPLOYER',
    isAutomatic: true,
  })

  // Pensión empleador (12%)
  const pensionEmpleador = roundCOP(ibc * PCT_PENSION_EMPLEADOR)
  employerContributions.push({
    concept: 'Pensión Empleador (12%)',
    code: 'EMP_PENSION',
    amount: pensionEmpleador,
    percentage: PCT_PENSION_EMPLEADOR * 100,
    type: 'EMPLOYER',
    isAutomatic: true,
  })

  // ARL (100% empleador)
  const arlRate = ARL_RATES[riskLevel] || ARL_RATES[1]
  const arlAmount = roundCOP(ibc * arlRate)
  employerContributions.push({
    concept: `ARL Nivel ${riskLevel} (${(arlRate * 100).toFixed(3)}%)`,
    code: 'EMP_ARL',
    amount: arlAmount,
    percentage: arlRate * 100,
    type: 'EMPLOYER',
    isAutomatic: true,
  })

  // CCF — Caja de Compensación (4%)
  const ccfAmount = roundCOP(ibc * PCT_CCF)
  employerContributions.push({
    concept: 'Caja de Compensación (4%)',
    code: 'EMP_CCF',
    amount: ccfAmount,
    percentage: PCT_CCF * 100,
    type: 'EMPLOYER',
    isAutomatic: true,
  })

  // ICBF (3%) — Solo si NO exonerado por Ley 1607
  // Empresas que pagan < 10 SMLMV están exoneradas si son personas jurídicas
  // Por simplicidad, lo incluimos siempre (el usuario puede desactivarlo)
  const icbfAmount = roundCOP(ibc * PCT_ICBF)
  employerContributions.push({
    concept: 'ICBF (3%)',
    code: 'EMP_ICBF',
    amount: icbfAmount,
    percentage: PCT_ICBF * 100,
    type: 'EMPLOYER',
    isAutomatic: true,
  })

  // SENA (2%)
  const senaAmount = roundCOP(ibc * PCT_SENA)
  employerContributions.push({
    concept: 'SENA (2%)',
    code: 'EMP_SENA',
    amount: senaAmount,
    percentage: PCT_SENA * 100,
    type: 'EMPLOYER',
    isAutomatic: true,
  })

  // --- TOTALES ---
  const totalEarnings = earnings.reduce((acc, e) => acc + e.amount, 0)
  const totalDeductions = deductions.reduce((acc, d) => acc + d.amount, 0)
  const netPay = totalEarnings - totalDeductions
  const totalEmployerContributions = employerContributions.reduce((acc, c) => acc + c.amount, 0)
  const totalEmployerCost = netPay + totalDeductions + totalEmployerContributions

  return {
    earnings,
    deductions,
    employerContributions,
    totalEarnings,
    totalDeductions,
    netPay,
    totalEmployerCost,
  }
}

/**
 * Calcula provisiones de prestaciones sociales mensuales para un empleado.
 * Estas NO se pagan en cada nómina, se provisionan mensualmente.
 * 
 * @param baseSalary - Salario base mensual
 * @param auxTransporte - ¿Incluir auxilio de transporte en base?
 * @returns Provisiones mensuales
 */
export function calculateSocialBenefitsProvision(
  baseSalary: number,
  includeAuxTransporte: boolean,
): {
  prima: number
  cesantias: number
  interesesCesantias: number
  vacaciones: number
  total: number
} {
  const baseForBenefits = includeAuxTransporte
    ? baseSalary + AUXILIO_TRANSPORTE_2025
    : baseSalary

  // Prima de servicios: (Salario + Aux) / 12
  const prima = roundCOP(baseForBenefits / 12)

  // Cesantías: (Salario + Aux) / 12
  const cesantias = roundCOP(baseForBenefits / 12)

  // Intereses sobre cesantías: Cesantías × 12% / 12
  const interesesCesantias = roundCOP((cesantias * 0.12))

  // Vacaciones: Salario base / 24 (NO incluye aux transporte)
  const vacaciones = roundCOP(baseSalary / 24)

  return {
    prima,
    cesantias,
    interesesCesantias,
    vacaciones,
    total: prima + cesantias + interesesCesantias + vacaciones,
  }
}
