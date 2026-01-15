// Permission constants
export const PERMISSIONS = {
  MANAGE_USERS: 'manage_users',
  MANAGE_PRODUCTS: 'manage_products',
  MANAGE_INVENTORY: 'manage_inventory',
  MANAGE_SALES: 'manage_sales',
  // Mostrador: control de devoluciones/anulaciones
  MANAGE_RETURNS: 'manage_returns',
  VOID_INVOICES: 'void_invoices',
  // Mostrador: control de descuentos
  APPLY_DISCOUNTS: 'apply_discounts',
  MANAGE_PURCHASES: 'manage_purchases',
  MANAGE_CRM: 'manage_crm',
  VIEW_REPORTS: 'view_reports',
  MANAGE_CASH: 'manage_cash',
} as const

export type Permission = typeof PERMISSIONS[keyof typeof PERMISSIONS]

// Role constants
export const ROLES = {
  ADMIN: 'ADMIN',
  MANAGER: 'MANAGER',
  CASHIER: 'CASHIER',
  SALES: 'SALES',
  WAREHOUSE: 'WAREHOUSE',
} as const

export type Role = typeof ROLES[keyof typeof ROLES]

// Check if user has permission
export function hasPermission(userPermissions: string[], permission: Permission): boolean {
  return userPermissions.includes(permission)
}

// Check if user has any of the permissions
export function hasAnyPermission(userPermissions: string[], permissions: Permission[]): boolean {
  return permissions.some(p => userPermissions.includes(p))
}

// Check if user has role
export function hasRole(userRoles: string[], role: Role): boolean {
  return userRoles.includes(role)
}

