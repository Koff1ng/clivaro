/**
 * Definición de funciones disponibles por plan
 */

export type PlanName = 'Starter' | 'Business' | 'Enterprise'

export interface PlanFeatures {
  // Productos e Inventario
  manageProducts: boolean
  manageInventory: boolean
  multiWarehouse: boolean

  // Ventas
  manageSales: boolean
  pos: boolean
  quotations: boolean
  invoices: boolean

  // CRM
  manageCRM: boolean
  leads: boolean
  marketing: boolean

  // Compras
  managePurchases: boolean

  // Caja
  manageCash: boolean

  // Finanzas y RRHH
  manageAccounting: boolean
  managePayroll: boolean

  // Reportes
  viewReports: boolean
  advancedReports: boolean

  // Usuarios
  manageUsers: boolean
  maxUsers: number

  // Otros
  apiAccess: boolean
  customReports: boolean
  dedicatedSupport: boolean
}

/**
 * Configuración de funciones por plan
 */
export const PLAN_FEATURES: Record<PlanName, PlanFeatures> = {
  Starter: {
    manageProducts: true,
    manageInventory: true,
    multiWarehouse: false,
    manageSales: true,
    pos: true,
    quotations: false,
    invoices: true,
    manageCRM: false,
    leads: false,
    marketing: false,
    managePurchases: true,
    manageCash: true,
    manageAccounting: false,
    managePayroll: false,
    viewReports: true,
    advancedReports: false,
    manageUsers: true,
    maxUsers: 2,
    apiAccess: false,
    customReports: false,
    dedicatedSupport: false,
  },
  Business: {
    manageProducts: true,
    manageInventory: true,
    multiWarehouse: true,
    manageSales: true,
    pos: true,
    quotations: true,
    invoices: true,
    manageCRM: true,
    leads: true,
    marketing: true,
    managePurchases: true,
    manageCash: true,
    manageAccounting: false, // Opcionalmente true si Business lo incluye, asumo Enterprise only por ahora
    managePayroll: false,
    viewReports: true,
    advancedReports: true,
    manageUsers: true,
    maxUsers: 5,
    apiAccess: false,
    customReports: false,
    dedicatedSupport: false,
  },
  Enterprise: {
    manageProducts: true,
    manageInventory: true,
    multiWarehouse: true,
    manageSales: true,
    pos: true,
    quotations: true,
    invoices: true,
    manageCRM: true,
    leads: true,
    marketing: true,
    managePurchases: true,
    manageCash: true,
    manageAccounting: true,
    managePayroll: true,
    viewReports: true,
    advancedReports: true,
    manageUsers: true,
    maxUsers: 15, // Ilimitado consultar
    apiAccess: true,
    customReports: true,
    dedicatedSupport: true,
  },
}

/**
 * Mapeo de rutas a funciones requeridas
 */
export const ROUTE_FEATURES: Record<string, keyof PlanFeatures> = {
  '/products': 'manageProducts',
  '/inventory': 'manageInventory',
  '/crm/customers': 'manageSales', // Starter tiene acceso básico
  '/crm/leads': 'leads',
  '/marketing/campaigns': 'marketing',
  '/sales/quotes': 'quotations',
  '/sales/invoices': 'invoices',
  '/dashboard/electronic-invoicing': 'invoices',
  '/purchases/suppliers': 'managePurchases',
  '/purchases/orders': 'managePurchases',
  '/purchases/receipts': 'managePurchases',
  '/pos': 'pos',
  '/cash/shifts': 'manageCash',
  '/admin/users': 'manageUsers',
  '/accounting': 'manageAccounting',
  '/accounting/accounts': 'manageAccounting',
  '/accounting/vouchers': 'manageAccounting',
  '/accounting/journal': 'manageAccounting',
  '/accounting/reports': 'manageAccounting',
  '/accounting/tax-info': 'manageAccounting',
  '/accounting/fiscal-conciliator': 'manageAccounting',
  '/accounting/addons': 'manageAccounting',
  '/payroll': 'managePayroll',
}

/**
 * Verifica si una función está disponible en un plan
 */
export function hasFeature(planName: PlanName | null, feature: keyof PlanFeatures): boolean {
  if (!planName) return false
  const features = PLAN_FEATURES[planName]
  return Boolean(features?.[feature])
}

/**
 * Obtiene todas las funciones disponibles para un plan
 */
export function getPlanFeatures(planName: PlanName | null): PlanFeatures | null {
  if (!planName) return null
  return PLAN_FEATURES[planName] || null
}

