'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useSession, signOut } from 'next-auth/react'
import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import {
  NavArrowRight,
  NavArrowDown, // New import
  Box,
  Archive,
  Group,
  KanbanBoard,
  Mail,
  Page,
  Cart as CartIcon,
  Bag,
  Shop,
  Wallet as WalletIcon,
  UserSquare,
  Settings as SettingsIcon,
  LogOut as LogOutIcon,
  ShieldCheck,
  PasteClipboard,
  Truck,
  StatsUpSquare,
  Calculator, // For Accounting/General
  Cash, // For Finances
} from 'iconoir-react'
import { Logo } from '@/components/ui/logo'
import { AppIcon } from '@/components/ui/app-icon'
import { useSidebar } from '@/lib/sidebar-context'
import { useTenantPlan } from '@/lib/hooks/use-plan-features'
// import { Button } from '@/components/ui/button' // Unused

// Define Group Structure
type MenuItem = {
  href: string
  label: string
  icon: any
  permission?: string | string[]
  planFeature?: string
}

type MenuGroup = {
  title: string
  key: string
  items: MenuItem[]
}

const menuGroups: MenuGroup[] = [
  {
    title: 'General',
    key: 'general',
    items: [
      { href: '/dashboard', label: 'Dashboard', icon: NavArrowRight, permission: ['view_reports', 'manage_sales'], planFeature: 'viewReports' },
      { href: '/dashboard/reports', label: 'Reportes', icon: StatsUpSquare, permission: 'view_reports', planFeature: 'viewReports' },
    ]
  },
  {
    title: 'Marketing',
    key: 'marketing',
    items: [
      { href: '/crm/customers', label: 'Clientes', icon: Group, permission: ['manage_crm', 'manage_sales'], planFeature: 'manageSales' },
      { href: '/crm/leads', label: 'Oportunidades', icon: KanbanBoard, permission: 'manage_crm', planFeature: 'leads' },
      { href: '/marketing/campaigns', label: 'Campañas', icon: Mail, permission: 'manage_crm', planFeature: 'marketing' },
    ]
  },
  {
    title: 'POS',
    key: 'pos',
    items: [
      { href: '/pos', label: 'Punta de Venta', icon: CartIcon, permission: 'manage_sales', planFeature: 'pos' },
      { href: '/cash/shifts', label: 'Caja', icon: WalletIcon, permission: ['manage_cash', 'manage_sales'], planFeature: 'manageCash' },
      { href: '/sales/quotes', label: 'Cotizaciones', icon: PasteClipboard, permission: 'manage_sales', planFeature: 'quotations' },
      { href: '/sales/orders', label: 'Órdenes', icon: PasteClipboard, permission: 'manage_sales', planFeature: 'manageSales' },
      { href: '/sales/invoices', label: 'Facturas', icon: Page, permission: 'manage_sales', planFeature: 'invoices' },
      { href: '/credit-notes', label: 'Notas Crédito', icon: PasteClipboard, permission: 'manage_sales', planFeature: 'invoices' },
      { href: '/dashboard/electronic-invoicing', label: 'Fact. Electrónica', icon: ShieldCheck, permission: 'manage_sales', planFeature: 'invoices' },
    ]
  },
  {
    title: 'Inventario',
    key: 'inventory',
    items: [
      { href: '/products', label: 'Items', icon: Box, permission: 'manage_products', planFeature: 'manageProducts' },
      { href: '/inventory', label: 'Inventario', icon: Archive, permission: 'manage_inventory', planFeature: 'manageInventory' },
      { href: '/purchases/suppliers', label: 'Proveedores', icon: Shop, permission: 'manage_purchases', planFeature: 'managePurchases' },
      { href: '/purchases/orders', label: 'Órdenes Compra', icon: Bag, permission: 'manage_purchases', planFeature: 'managePurchases' },
      { href: '/purchases/receipts', label: 'Recepciones', icon: Truck, permission: 'manage_purchases', planFeature: 'managePurchases' },
    ]
  },
  {
    title: 'Contabilidad',
    key: 'accounting',
    items: [
      { href: '/accounting/accounts', label: 'Catálogo de cuentas', icon: Page, permission: 'manage_crm', planFeature: 'manageAccounting' },
      { href: '/accounting/vouchers', label: 'Comprobante contable', icon: PasteClipboard, permission: 'manage_crm', planFeature: 'manageAccounting' },
      { href: '/accounting/journal', label: 'Libro diario', icon: Page, permission: 'manage_crm', planFeature: 'manageAccounting' },
      { href: '/accounting/reports', label: 'Reportes contables', icon: StatsUpSquare, permission: 'manage_crm', planFeature: 'manageAccounting' },
      { href: '/accounting/tax-info', label: 'Información exógena', icon: ShieldCheck, permission: 'manage_crm', planFeature: 'manageAccounting' },
      { href: '/accounting/fiscal-conciliator', label: 'Conciliador fiscal', icon: Calculator, permission: 'manage_crm', planFeature: 'manageAccounting' },
      { href: '/accounting/addons', label: 'Complementos contables', icon: Box, permission: 'manage_crm', planFeature: 'manageAccounting' },
    ]
  },
  {
    title: 'Recursos Humanos',
    key: 'hr',
    items: [
      { href: '/payroll/employees', label: 'Empleados', icon: Group, permission: 'manage_users', planFeature: 'managePayroll' },
      { href: '/payroll/runs', label: 'Nómina', icon: WalletIcon, permission: 'manage_users', planFeature: 'managePayroll' },
    ]
  },
  {
    title: 'Sistema',
    key: 'system',
    items: [
      { href: '/admin/users', label: 'Usuarios', icon: UserSquare, permission: 'manage_users', planFeature: 'manageUsers' },
      { href: '/settings', label: 'Configuración', icon: SettingsIcon, permission: 'manage_users', planFeature: 'manageUsers' },
    ]
  }
]

export function Sidebar() {
  const pathname = usePathname()
  // const router = useRouter() // Unused
  const { data: session } = useSession()
  const { isOpen, toggle } = useSidebar()
  const userPermissions = (session?.user as any)?.permissions || []
  const isSuperAdmin = (session?.user as any)?.isSuperAdmin || false
  const { hasFeature: hasPlanFeature, isNewFeature, newFeatures, isLoading, planName } = useTenantPlan()
  const [visitedFeatures, setVisitedFeatures] = useState<Record<string, number>>({})

  // Persist scroll position
  useEffect(() => {
    const nav = document.getElementById('sidebar-nav')
    if (nav) {
      const savedScroll = sessionStorage.getItem('sidebar-scroll')
      if (savedScroll) nav.scrollTop = parseInt(savedScroll)
    }
  }, [pathname])

  const handleScroll = (e: React.UIEvent<HTMLElement>) => {
    sessionStorage.setItem('sidebar-scroll', e.currentTarget.scrollTop.toString())
  }

  // State for collapsible groups. Default all open or specific logic.
  // Using a map for open/closed state. Default to true (open).
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    general: true,
    comercial: true,
    inventory: true,
    treasury: true,
    accounting: true,
    hr: true,
    system: true
  })

  const toggleGroup = (key: string) => {
    setOpenGroups(prev => ({ ...prev, [key]: !prev[key] }))
  }

  // Effect for Visited Features (Persistance) - SAME AS BEFORE
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('visited-new-features')
      if (stored) {
        try {
          const parsed = JSON.parse(stored)
          const visited: Record<string, number> = {}
          Object.keys(parsed).forEach((key) => {
            visited[key] = Date.now()
          })
          setVisitedFeatures(visited)
        } catch (e) { }
      }
    }
  }, [])

  const handleFeatureClick = (feature: string) => {
    if (!isNewFeature(feature as any)) return
    const featureKey = feature
    const now = Date.now()

    if (!visitedFeatures[featureKey]) {
      const updated = { ...visitedFeatures, [featureKey]: now }
      setVisitedFeatures(updated)
      if (typeof window !== 'undefined') {
        localStorage.setItem('visited-new-features', JSON.stringify(updated))
      }
      setTimeout(() => {
        setVisitedFeatures(prev => {
          const newVisited = { ...prev }
          if (typeof window !== 'undefined') {
            localStorage.setItem('visited-new-features', JSON.stringify(newVisited))
          }
          return newVisited
        })
      }, 60 * 1000)
    }
  }

  useEffect(() => {
    if (!pathname || !newFeatures || newFeatures.length === 0) return
    const allItems = menuGroups.flatMap(g => g.items)
    const currentFeature = allItems.find(item => {
      const isActive = pathname === item.href || pathname?.startsWith(item.href + '/')
      return isActive && item.planFeature && isNewFeature(item.planFeature as any)
    })
    if (currentFeature?.planFeature) {
      handleFeatureClick(currentFeature.planFeature)
    }
  }, [pathname, newFeatures, isNewFeature])

  const shouldShowNewBadge = (feature: string) => {
    if (!isNewFeature(feature as any)) return false
    const visitTime = visitedFeatures[feature]
    if (!visitTime) return true
    const now = Date.now()
    const timeSinceClick = now - visitTime
    return timeSinceClick < 60 * 1000
  }

  // Filter Items Function
  const filterGroupItems = (items: MenuItem[]) => {
    return items.filter(item => {
      let hasPermission = true
      // Super Admin bypass: Always has permission
      if (isSuperAdmin) {
        hasPermission = true
      } else if (item.permission) {
        if (Array.isArray(item.permission)) {
          hasPermission = item.permission.some(perm => userPermissions.includes(perm))
        } else {
          hasPermission = userPermissions.includes(item.permission)
        }
      }
      if (!hasPermission) return false

      if (item.planFeature && !isSuperAdmin) {
        if (isLoading) return true
        if (!planName) return true
        return hasPlanFeature(item.planFeature as any)
      }
      return true
    })
  }

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden transition-opacity duration-300"
          onClick={toggle}
        />
      )}

      <aside
        className={cn(
          'fixed md:static top-0 left-0 z-50 h-screen flex flex-col border-r border-slate-800 bg-[#0F172A] text-slate-100 transition-all duration-300 ease-in-out overflow-hidden',
          isOpen ? 'w-64 translate-x-0' : 'w-0 -translate-x-full md:translate-x-0 md:w-16'
        )}
      >
        {isOpen && (
          <div className={cn(
            'flex items-center justify-center border-b border-slate-800 px-1 transition-opacity duration-300 opacity-100 h-14 sm:h-16'
          )}>
            <Link href="/dashboard" prefetch scroll={false} className="w-full flex justify-center items-center h-full">
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '100%',
                  maxHeight: '100%',
                  overflow: 'hidden',
                }}
              >
                <div className="text-white w-full">
                  <Logo
                    size="lg"
                    showByline={false}
                    className="!w-48 md:!w-64 !h-auto !justify-start -ml-2 mt-4"
                  />
                </div>
              </div>
            </Link>
          </div>
        )}

        <nav
          id="sidebar-nav"
          onScroll={handleScroll}
          className={cn(
            'flex-1 transition-opacity duration-300 overflow-y-auto overflow-x-hidden custom-scrollbar',
            isOpen ? 'opacity-100' : 'opacity-0 md:opacity-100',
            !isOpen && 'scrollbar-hide'
          )}>
          <div className={cn('flex flex-col gap-1', isOpen ? 'p-3' : 'p-1')}>

            {menuGroups.map((group, groupIndex) => {
              const visibleItems = filterGroupItems(group.items)
              if (visibleItems.length === 0) return null

              const isGroupOpen = openGroups[group.key]

              return (
                <div key={group.key} className={cn("mb-2", { 'border-t border-slate-800 pt-2 mt-2': groupIndex > 0 && !isOpen })}>
                  {/* Group Header - Only visible when Open */}
                  {isOpen && (
                    <div
                      className="flex items-center justify-between px-3 py-2 text-xs font-semibold text-slate-400 uppercase tracking-wider cursor-pointer hover:text-white transition-colors select-none"
                      onClick={() => toggleGroup(group.key)}
                    >
                      <span>{group.title}</span>
                      <NavArrowDown className={cn("w-3 h-3 transition-transform duration-200", !isGroupOpen && "-rotate-90")} />
                    </div>
                  )}

                  {/* Render Items */}
                  <div className={cn(
                    "flex flex-col gap-0.5 transition-all duration-300 ease-in-out overflow-hidden",
                    isOpen && !isGroupOpen ? "max-h-0 opacity-0" : "max-h-[500px] opacity-100"
                  )}>
                    {visibleItems.map(item => {
                      const Icon = item.icon
                      const isActive = pathname === item.href || pathname?.startsWith(item.href + '/')

                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          prefetch
                          scroll={false}
                          onClick={() => {
                            if (item.planFeature && shouldShowNewBadge(item.planFeature)) {
                              handleFeatureClick(item.planFeature)
                            }
                          }}
                          className={cn(
                            'flex items-center gap-3 rounded-lg text-sm font-medium transition-colors relative group',
                            isActive
                              ? 'bg-[#0EA5E9] text-white shadow-lg shadow-cyan-500/20'
                              : 'text-slate-400 hover:bg-slate-800 hover:text-white',
                            isOpen ? 'px-3 py-2 ml-1' : 'px-2 py-2 md:justify-center'
                          )}
                          title={!isOpen ? item.label : undefined}
                        >
                          <AppIcon icon={Icon} className="w-5 h-5 flex-shrink-0" />
                          <span className={cn(
                            'transition-opacity duration-300 whitespace-nowrap flex items-center gap-1.5',
                            isOpen ? 'opacity-100' : 'opacity-0 md:hidden'
                          )}>
                            {item.label}
                            {item.planFeature && shouldShowNewBadge(item.planFeature) && (
                              <span className="px-1 py-0.5 text-[9px] font-bold text-white bg-green-500 rounded-full animate-pulse">
                                NUEVO
                              </span>
                            )}
                          </span>
                          {!isOpen && (
                            <span className="absolute left-full ml-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50 hidden md:block">
                              {item.label}
                            </span>
                          )}
                        </Link>
                      )
                    })}
                  </div>
                </div>
              )
            })}

            {isSuperAdmin && (
              <div className="pt-2 mt-2 border-t border-slate-800">
                {isOpen && <p className="px-3 py-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">Super Admin</p>}
                <Link
                  href="/admin/tenants"
                  prefetch
                  scroll={false}
                  className={cn(
                    'flex items-center gap-3 rounded-lg text-sm font-medium transition-colors relative group',
                    pathname?.startsWith('/admin/tenants')
                      ? 'bg-[#0EA5E9]/20 text-[#0EA5E9]'
                      : 'text-slate-500 hover:bg-slate-800 hover:text-slate-300',
                    isOpen ? 'px-3 py-2 ml-1' : 'px-2 py-2 md:justify-center'
                  )}
                  title={!isOpen ? 'Tenants' : undefined}
                >
                  <ShieldCheck className="w-5 h-5 flex-shrink-0" />
                  <span className={cn(
                    'transition-opacity duration-300 whitespace-nowrap',
                    isOpen ? 'opacity-100' : 'opacity-0 md:hidden'
                  )}>
                    Tenants
                  </span>
                </Link>
              </div>
            )}

          </div>
        </nav>

        <div className={cn(
          'border-t border-slate-800 space-y-2 transition-opacity duration-300',
          isOpen ? 'opacity-100 p-4' : 'opacity-0 md:opacity-100 p-2'
        )}>
          {isOpen && (
            <div className="px-3 text-sm text-slate-400 truncate">
              {session?.user?.name}
            </div>
          )}
          <button
            onClick={() => signOut({ callbackUrl: '/login' })}
            className={cn(
              'flex w-full items-center gap-3 rounded-lg text-sm font-medium text-slate-400 hover:bg-slate-800 hover:text-white transition-colors relative group',
              isOpen ? 'px-3 py-2' : 'px-2 py-2 md:justify-center'
            )}
            title={!isOpen ? 'Cerrar Sesión' : undefined}
          >
            <LogOutIcon className="h-5 w-5 flex-shrink-0" />
            <span className={cn(
              'transition-opacity duration-300 whitespace-nowrap',
              isOpen ? 'opacity-100' : 'opacity-0 md:hidden'
            )}>
              Cerrar Sesión
            </span>
          </button>
        </div>
      </aside>
    </>
  )
}
