/**
 * Estados de facturas en español
 */
export const INVOICE_STATUS = {
  EMITIDA: 'EMITIDA',
  PAGADA: 'PAGADA',
  ANULADA: 'ANULADA',
  EN_COBRANZA: 'EN_COBRANZA', // En cobranza (parcialmente pagada)
} as const

export type InvoiceStatus = typeof INVOICE_STATUS[keyof typeof INVOICE_STATUS]

/**
 * Mapeo de estados antiguos (inglés) a nuevos (español)
 */
export const STATUS_MIGRATION: Record<string, string> = {
  'ISSUED': INVOICE_STATUS.EMITIDA,
  'PAID': INVOICE_STATUS.PAGADA,
  'VOID': INVOICE_STATUS.ANULADA,
}

/**
 * Convierte un estado antiguo a uno nuevo
 */
export function migrateStatus(oldStatus: string): InvoiceStatus {
  return (STATUS_MIGRATION[oldStatus] || oldStatus) as InvoiceStatus
}

/**
 * Verifica si una factura está pagada completamente
 */
export function isPaid(status: string): boolean {
  return status === INVOICE_STATUS.PAGADA
}

/**
 * Verifica si una factura está pendiente de pago
 */
export function isPending(status: string): boolean {
  return status === INVOICE_STATUS.EMITIDA || status === INVOICE_STATUS.EN_COBRANZA
}

/**
 * Verifica si una factura está anulada
 */
export function isVoid(status: string): boolean {
  return status === INVOICE_STATUS.ANULADA
}

/**
 * Obtiene el label en español de un estado
 */
export function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    [INVOICE_STATUS.EMITIDA]: 'Emitida',
    [INVOICE_STATUS.PAGADA]: 'Pagada',
    [INVOICE_STATUS.ANULADA]: 'Anulada',
    [INVOICE_STATUS.EN_COBRANZA]: 'En Cobranza',
    // Compatibilidad con estados antiguos
    'ISSUED': 'Emitida',
    'PAID': 'Pagada',
    'VOID': 'Anulada',
    'PARCIAL': 'En Cobranza',
    'PARTIAL': 'En Cobranza',
  }
  return labels[status] || status
}

/**
 * Obtiene el color de un estado
 */
export function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    [INVOICE_STATUS.EMITIDA]: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    [INVOICE_STATUS.PAGADA]: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    [INVOICE_STATUS.ANULADA]: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
    [INVOICE_STATUS.EN_COBRANZA]: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
    // Compatibilidad con estados antiguos
    'ISSUED': 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    'PAID': 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    'VOID': 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
    'PARCIAL': 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
    'PARTIAL': 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  }
  return colors[status] || 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200'
}

