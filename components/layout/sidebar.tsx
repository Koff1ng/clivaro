'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useSession, signOut } from 'next-auth/react'
import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import {
  NavArrowRight,
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
} from 'iconoir-react'
import { Logo } from '@/components/ui/logo'
import { AppIcon } from '@/components/ui/app-icon'
import { useSidebar } from '@/lib/sidebar-context'
import { Button } from '@/components/ui/button'
import { useTenantPlan } from '@/lib/hooks/use-plan-features'
import { ROUTE_FEATURES } from '@/lib/plan-features'

const menuItems = [
  { href: '/dashboard', label: 'Dashboard', icon: NavArrowRight, permission: ['view_reports', 'manage_sales'], planFeature: 'viewReports' },
  { href: '/products', label: 'Productos', icon: Box, permission: 'manage_products', planFeature: 'manageProducts' },
  { href: '/inventory', label: 'Inventario', icon: Archive, permission: 'manage_inventory', planFeature: 'manageInventory' },
  { href: '/crm/customers', label: 'Clientes', icon: Group, permission: ['manage_crm', 'manage_sales'], planFeature: 'manageSales' },
  { href: '/crm/leads', label: 'Oportunidades', icon: KanbanBoard, permission: 'manage_crm', planFeature: 'leads' },
  { href: '/marketing/campaigns', label: 'Campañas', icon: Mail, permission: 'manage_crm', planFeature: 'marketing' },
  { href: '/sales/quotes', label: 'Cotizaciones', icon: Page, permission: 'manage_sales', planFeature: 'quotations' },
  { href: '/sales/invoices', label: 'Facturas', icon: Page, permission: 'manage_sales', planFeature: 'invoices' },
  { href: '/purchases/suppliers', label: 'Proveedores', icon: Shop, permission: 'manage_purchases', planFeature: 'managePurchases' },
  { href: '/purchases/orders', label: 'Órdenes Compra', icon: Bag, permission: 'manage_purchases', planFeature: 'managePurchases' },
  { href: '/purchases/receipts', label: 'Recepciones', icon: Box, permission: 'manage_purchases', planFeature: 'managePurchases' },
  { href: '/pos', label: 'Punto de Venta', icon: CartIcon, permission: 'manage_sales', planFeature: 'pos' },
  { href: '/cash/shifts', label: 'Caja', icon: WalletIcon, permission: ['manage_cash', 'manage_sales'], planFeature: 'manageCash' },
  { href: '/admin/users', label: 'Usuarios', icon: UserSquare, permission: 'manage_users', planFeature: 'manageUsers' },
  { href: '/settings', label: 'Configuración', icon: SettingsIcon, permission: 'manage_users', planFeature: 'manageUsers' },
]

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const { data: session } = useSession()
  const { isOpen, toggle } = useSidebar()
  const userPermissions = (session?.user as any)?.permissions || []
  const isSuperAdmin = (session?.user as any)?.isSuperAdmin || false
  const { hasFeature: hasPlanFeature, isNewFeature, newFeatures, isLoading, planName } = useTenantPlan()
  const [visitedFeatures, setVisitedFeatures] = useState<Record<string, number>>({})

  // Cargar features visitadas desde localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('visited-new-features')
      if (stored) {
        try {
          const parsed = JSON.parse(stored)
          // Las features visitadas se guardan permanentemente hasta que se limpien manualmente
          // Convertir a un objeto simple de strings (sin timestamps, solo marcar como visitadas)
          const visited: Record<string, number> = {}
          Object.keys(parsed).forEach((key) => {
            visited[key] = Date.now() // Mantener timestamp para compatibilidad
          })
          setVisitedFeatures(visited)
        } catch (e) {
          // Ignorar errores de parseo
        }
      }
    }
  }, [])

  // Marcar feature como visitada cuando se hace click en ella
  const handleFeatureClick = (feature: string) => {
    if (!isNewFeature(feature as any)) return
    
    const featureKey = feature
    const now = Date.now()
    
    // Si no está visitada, marcar timestamp de click
    if (!visitedFeatures[featureKey]) {
      const updated = { ...visitedFeatures, [featureKey]: now }
      setVisitedFeatures(updated)
      if (typeof window !== 'undefined') {
        localStorage.setItem('visited-new-features', JSON.stringify(updated))
      }
      
      // Después de 1 minuto, marcar como permanentemente visitada
      setTimeout(() => {
        setVisitedFeatures(prev => {
          const newVisited = { ...prev }
          // Mantener el timestamp para indicar que fue visitada permanentemente
          if (typeof window !== 'undefined') {
            localStorage.setItem('visited-new-features', JSON.stringify(newVisited))
          }
          return newVisited
        })
      }, 60 * 1000) // 1 minuto
    }
  }

  // Marcar feature como visitada cuando se navega a ella (fallback)
  useEffect(() => {
    if (!pathname || !newFeatures || newFeatures.length === 0) return

    // Encontrar la feature correspondiente a la ruta actual
    const currentFeature = menuItems.find(item => {
      const isActive = pathname === item.href || pathname?.startsWith(item.href + '/')
      return isActive && item.planFeature && isNewFeature(item.planFeature as any)
    })

    if (currentFeature?.planFeature) {
      handleFeatureClick(currentFeature.planFeature)
    }
  }, [pathname, newFeatures, isNewFeature])

  // Función para verificar si una feature debe mostrar la etiqueta "NUEVO"
  const shouldShowNewBadge = (feature: string) => {
    if (!isNewFeature(feature as any)) return false
    
    const visitTime = visitedFeatures[feature]
    if (!visitTime) return true // No ha sido visitada, mostrar
    
    // Si fue visitada hace menos de 1 minuto, aún mostrar el badge
    // Después de 1 minuto, desaparecer permanentemente
    const now = Date.now()
    const timeSinceClick = now - visitTime
    return timeSinceClick < 60 * 1000 // Mostrar solo si pasó menos de 1 minuto
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
    // Si no hay plan activo o está cargando, mostrar elementos basándose solo en permisos
    // (asumir acceso completo si no hay plan para evitar ocultar el sidebar)
    if (item.planFeature && !isSuperAdmin) {
      // Si está cargando el plan, mostrar el elemento (evitar ocultar mientras carga)
      if (isLoading) {
        return true
      }
      // Si no hay plan activo, mostrar todos los elementos (asumir acceso completo)
      if (!planName) {
        return true
      }
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
                onClick={() => {
                  // Si tiene badge "NUEVO", marcar como visitada al hacer click
                  if (item.planFeature && shouldShowNewBadge(item.planFeature)) {
                    handleFeatureClick(item.planFeature)
                  }
                }}
                className={cn(
                  'flex items-center gap-3 rounded-lg text-sm font-medium transition-colors relative group',
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                  isOpen ? 'px-3 py-2' : 'px-2 py-2 md:justify-center'
                )}
                title={!isOpen ? item.label : undefined}
              >
                <AppIcon icon={Icon} />
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

