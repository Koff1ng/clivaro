'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useSession, signOut } from 'next-auth/react'
import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  Package,
  Warehouse,
  Users,
  FileText,
  ShoppingCart,
  ShoppingBag,
  Receipt,
  CreditCard,
  BarChart3,
  Settings,
  LogOut,
  Mail,
  Target,
  FileCheck,
  Building2,
  PackageCheck,
  Store,
  Wallet,
  UserCog,
  Shield,
} from 'lucide-react'
import { Logo } from '@/components/ui/logo'
import { ThemeToggle } from '@/components/theme/theme-toggle'
import { useSidebar } from '@/lib/sidebar-context'
import { Button } from '@/components/ui/button'
import { useTenantPlan } from '@/lib/hooks/use-plan-features'
import { ROUTE_FEATURES } from '@/lib/plan-features'

const menuItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, permission: ['view_reports', 'manage_sales'], planFeature: 'viewReports' },
  { href: '/products', label: 'Productos', icon: Package, permission: 'manage_products', planFeature: 'manageProducts' },
  { href: '/inventory', label: 'Inventario', icon: Warehouse, permission: 'manage_inventory', planFeature: 'manageInventory' },
  { href: '/crm/customers', label: 'Clientes', icon: Users, permission: ['manage_crm', 'manage_sales'], planFeature: 'manageSales' },
  { href: '/crm/leads', label: 'Oportunidades', icon: Target, permission: 'manage_crm', planFeature: 'leads' },
  { href: '/marketing/campaigns', label: 'Campañas', icon: Mail, permission: 'manage_crm', planFeature: 'marketing' },
  { href: '/sales/quotes', label: 'Cotizaciones', icon: FileCheck, permission: 'manage_sales', planFeature: 'quotations' },
  { href: '/sales/invoices', label: 'Facturas', icon: Receipt, permission: 'manage_sales', planFeature: 'invoices' },
  { href: '/purchases/suppliers', label: 'Proveedores', icon: Building2, permission: 'manage_purchases', planFeature: 'managePurchases' },
  { href: '/purchases/orders', label: 'Órdenes Compra', icon: ShoppingBag, permission: 'manage_purchases', planFeature: 'managePurchases' },
  { href: '/purchases/receipts', label: 'Recepciones', icon: PackageCheck, permission: 'manage_purchases', planFeature: 'managePurchases' },
  { href: '/pos', label: 'Punto de Venta', icon: ShoppingCart, permission: 'manage_sales', planFeature: 'pos' },
  { href: '/cash/shifts', label: 'Caja', icon: Wallet, permission: ['manage_cash', 'manage_sales'], planFeature: 'manageCash' },
  { href: '/admin/users', label: 'Usuarios', icon: UserCog, permission: 'manage_users', planFeature: 'manageUsers' },
]

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const { data: session } = useSession()
  const { isOpen, toggle } = useSidebar()
  const userPermissions = (session?.user as any)?.permissions || []
  const isSuperAdmin = (session?.user as any)?.isSuperAdmin || false
  const { hasFeature: hasPlanFeature, isNewFeature, newFeatures } = useTenantPlan()
  const [visitedFeatures, setVisitedFeatures] = useState<Record<string, number>>({})

  // Cargar features visitadas desde localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('visited-new-features')
      if (stored) {
        try {
          const parsed = JSON.parse(stored)
          // Limpiar entradas que ya pasaron los 3 minutos
          const now = Date.now()
          const filtered: Record<string, number> = {}
          Object.keys(parsed).forEach((key) => {
            if (now - parsed[key] < 3 * 60 * 1000) { // 3 minutos
              filtered[key] = parsed[key]
            }
          })
          setVisitedFeatures(filtered)
          if (Object.keys(filtered).length !== Object.keys(parsed).length) {
            localStorage.setItem('visited-new-features', JSON.stringify(filtered))
          }
        } catch (e) {
          // Ignorar errores de parseo
        }
      }
    }
  }, [])

  // Marcar feature como visitada cuando se navega a ella
  useEffect(() => {
    if (!pathname || !newFeatures || newFeatures.length === 0) return

    // Encontrar la feature correspondiente a la ruta actual
    const currentFeature = menuItems.find(item => {
      const isActive = pathname === item.href || pathname?.startsWith(item.href + '/')
      return isActive && item.planFeature && isNewFeature(item.planFeature as any)
    })

    if (currentFeature?.planFeature) {
      const featureKey = currentFeature.planFeature
      const now = Date.now()
      
      // Si no está visitada, marcar como visitada
      if (!visitedFeatures[featureKey]) {
        const updated = { ...visitedFeatures, [featureKey]: now }
        setVisitedFeatures(updated)
        if (typeof window !== 'undefined') {
          localStorage.setItem('visited-new-features', JSON.stringify(updated))
        }
      }
    }
  }, [pathname, newFeatures, visitedFeatures, isNewFeature])

  // Limpiar etiquetas después de 3 minutos de visitar una función
  useEffect(() => {
    if (Object.keys(visitedFeatures).length === 0) return

    const interval = setInterval(() => {
      const now = Date.now()
      const updated: Record<string, number> = {}
      let hasChanges = false

      Object.keys(visitedFeatures).forEach((key) => {
        const visitTime = visitedFeatures[key]
        const timeSinceVisit = now - visitTime
        
        // Mantener solo las que aún no han pasado los 3 minutos
        if (timeSinceVisit < 3 * 60 * 1000) {
          updated[key] = visitTime
        } else {
          hasChanges = true
        }
      })

      if (hasChanges) {
        setVisitedFeatures(updated)
        if (typeof window !== 'undefined') {
          if (Object.keys(updated).length === 0) {
            localStorage.removeItem('visited-new-features')
          } else {
            localStorage.setItem('visited-new-features', JSON.stringify(updated))
          }
        }
      }
    }, 10000) // Verificar cada 10 segundos

    return () => clearInterval(interval)
  }, [visitedFeatures])

  // Función para verificar si una feature debe mostrar la etiqueta "NUEVO"
  const shouldShowNewBadge = (feature: string) => {
    if (!isNewFeature(feature as any)) return false
    
    const visitTime = visitedFeatures[feature]
    if (!visitTime) return true // No ha sido visitada, mostrar
    
    const now = Date.now()
    const timeSinceVisit = now - visitTime
    
    // Mostrar solo si han pasado menos de 3 minutos desde la visita
    return timeSinceVisit < 3 * 60 * 1000
  }

  const filteredMenuItems = menuItems.filter(item => {
    // Verificar permisos de usuario primero
    let hasPermission = true
    if (item.permission) {
      if (Array.isArray(item.permission)) {
        hasPermission = item.permission.some(perm => userPermissions.includes(perm))
      } else {
        hasPermission = userPermissions.includes(item.permission)
      }
    }

    if (!hasPermission) return false

    // Verificar feature del plan
    if (item.planFeature && !isSuperAdmin) {
      return hasPlanFeature(item.planFeature as any)
    }

    return true
  })

  return (
    <>
      {/* Overlay para móviles cuando el sidebar está abierto */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden transition-opacity duration-300"
          onClick={toggle}
        />
      )}
      
      {/* Sidebar */}
      <aside
        className={cn(
          'fixed md:static top-0 left-0 z-50 h-screen flex flex-col border-r bg-card transition-all duration-300 ease-in-out',
          isOpen ? 'w-64 translate-x-0' : 'w-0 -translate-x-full md:translate-x-0 md:w-16'
        )}
      >
        {isOpen && (
          <div className={cn(
            'flex items-center justify-center border-b px-1 transition-opacity duration-300 opacity-100'
          )} style={{ height: '100px' }}>
            <Link href="/dashboard" prefetch className="w-full flex justify-center py-2">
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '100%',
                  maxHeight: '64px',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    transform: 'scale(1.1)',
                    transformOrigin: 'center',
                    marginTop: 0,
                    marginBottom: 0,
                  }}
                >
                  <Logo size="md" showByline={false} />
                </div>
              </div>
            </Link>
          </div>
        )}

        <nav className={cn(
          'flex-1 transition-opacity duration-300',
          isOpen ? 'opacity-100 overflow-y-auto space-y-1 p-4' : 'opacity-0 md:opacity-100 md:overflow-visible space-y-0.5 p-1'
        )}>
          {filteredMenuItems.map((item) => {
            const Icon = item.icon
            const isActive = pathname === item.href || pathname?.startsWith(item.href + '/')
            return (
              <Link
                key={item.href}
                href={item.href}
                prefetch
                className={cn(
                  'flex items-center gap-3 rounded-lg text-sm font-medium transition-colors relative group',
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                  isOpen ? 'px-3 py-2' : 'px-2 py-2 md:justify-center'
                )}
                title={!isOpen ? item.label : undefined}
              >
                <Icon className="h-5 w-5 flex-shrink-0" />
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
                {/* Tooltip para cuando está colapsado */}
                {!isOpen && (
                  <span className="absolute left-full ml-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50 hidden md:block">
                    {item.label}
                  </span>
                )}
              </Link>
            )
          })}
          {isSuperAdmin && (
            <Link
              href="/admin/tenants"
              prefetch
              className={cn(
                'flex items-center gap-3 rounded-lg text-sm font-medium transition-colors relative group',
                pathname?.startsWith('/admin/tenants')
                  ? 'bg-primary/20 text-primary dark:bg-primary/30'
                  : 'text-muted-foreground/60 hover:bg-accent/50 hover:text-muted-foreground',
                isOpen ? 'px-3 py-2' : 'px-2 py-2 md:justify-center'
              )}
              title={!isOpen ? 'Admin' : undefined}
            >
              <Shield className="h-4 w-4 flex-shrink-0 opacity-70" />
              <span className={cn(
                'transition-opacity duration-300 whitespace-nowrap text-xs',
                isOpen ? 'opacity-100' : 'opacity-0 md:hidden'
              )}>
                Admin
              </span>
              {!isOpen && (
                <span className="absolute left-full ml-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50 hidden md:block">
                  Admin
                </span>
              )}
            </Link>
          )}
        </nav>
        <div className={cn(
          'border-t space-y-2 transition-opacity duration-300',
          isOpen ? 'opacity-100 p-4' : 'opacity-0 md:opacity-100 p-2'
        )}>
          <div className={cn('flex items-center', !isOpen && 'md:justify-center')}>
            <ThemeToggle />
          </div>
          {isOpen && (
            <div className="px-3 text-sm text-muted-foreground">
              {session?.user?.name}
            </div>
          )}
          <button
            onClick={() => signOut({ callbackUrl: '/login' })}
            className={cn(
              'flex w-full items-center gap-3 rounded-lg text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors relative group',
              isOpen ? 'px-3 py-2' : 'px-2 py-2 md:justify-center'
            )}
            title={!isOpen ? 'Cerrar Sesión' : undefined}
          >
            <LogOut className="h-5 w-5 flex-shrink-0" />
            <span className={cn(
              'transition-opacity duration-300 whitespace-nowrap',
              isOpen ? 'opacity-100' : 'opacity-0 md:hidden'
            )}>
              Cerrar Sesión
            </span>
            {!isOpen && (
              <span className="absolute left-full ml-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50 hidden md:block">
                Cerrar Sesión
              </span>
            )}
          </button>
        </div>
      </aside>
    </>
  )
}

