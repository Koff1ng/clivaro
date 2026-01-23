'use client'

import { useSession } from 'next-auth/react'
import { useSidebar } from '@/lib/sidebar-context'
import { Button } from '@/components/ui/button'
import { Menu, Bell, User } from 'lucide-react'
import { ThemeToggle } from '@/components/theme/theme-toggle'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { signOut } from 'next-auth/react'
import { useQuery } from '@tanstack/react-query'
import { formatDateTime } from '@/lib/utils'
import { useState, useEffect } from 'react'
import {
  Package,
  DollarSign,
  ArrowUpCircle,
  ArrowDownCircle,
  FileText,
  ShoppingBag,
  Truck,
  FileSearch,
  Phone,
  Mail,
  Calendar,
  CheckSquare,
  TrendingUp,
} from 'lucide-react'

async function fetchActivityFeed() {
  const res = await fetch('/api/activity-feed?limit=10')
  if (!res.ok) throw new Error('Failed to fetch activity feed')
  return res.json()
}

const LAST_READ_KEY = 'notifications_last_read'

export function Header() {
  const { isOpen, toggle } = useSidebar()
  const { data: session } = useSession()
  const [lastReadTimestamp, setLastReadTimestamp] = useState<string | null>(null)
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)

  // Cargar el timestamp de última lectura desde localStorage
  useEffect(() => {
    const stored = localStorage.getItem(LAST_READ_KEY)
    if (stored) {
      setLastReadTimestamp(stored)
    }
  }, [])

  const { data: activityData, isLoading: isLoadingActivities } = useQuery({
    queryKey: ['activity-feed-notifications'],
    queryFn: fetchActivityFeed,
    refetchInterval: 30 * 1000, // Actualizar cada 30 segundos
    staleTime: 20 * 1000, // Los datos se consideran frescos por 20 segundos
    refetchOnWindowFocus: true,
  })

  const activities = activityData?.activities || []

  // Verificar si hay notificaciones no leídas
  const hasUnreadNotifications = activities.some((activity: any) => {
    if (!lastReadTimestamp) return true // Si nunca se ha leído, todas son no leídas
    const activityDate = new Date(activity.createdAt).getTime()
    const lastReadDate = new Date(lastReadTimestamp).getTime()
    return activityDate > lastReadDate
  })

  // Marcar como leídas cuando se abre el dropdown
  const handleDropdownOpenChange = (open: boolean) => {
    setIsDropdownOpen(open)
    if (open && activities.length > 0) {
      // Obtener la fecha más reciente de las actividades
      const mostRecentActivity = activities[0] // Ya están ordenadas por fecha descendente
      const newLastRead = mostRecentActivity.createdAt

      // Guardar en localStorage
      localStorage.setItem(LAST_READ_KEY, newLastRead)
      setLastReadTimestamp(newLastRead)
    }
  }

  const getActivityIcon = (type: string, icon?: string) => {
    const iconMap: Record<string, any> = {
      'STOCK_ADJUSTMENT': TrendingUp,
      'PAYMENT': DollarSign,
      'CASH_MOVEMENT': ArrowUpCircle,
      'PRODUCT': Package,
      'INVOICE': FileText,
      'PURCHASE_ORDER': ShoppingBag,
      'GOODS_RECEIPT': Truck,
      'QUOTATION': FileSearch,
      'CRM_ACTIVITY': FileText,
      'phone': Phone,
      'mail': Mail,
      'calendar': Calendar,
      'check-square': CheckSquare,
      'file-text': FileText,
      'package': Package,
      'arrow-up-circle': ArrowUpCircle,
      'arrow-down-circle': ArrowDownCircle,
      'dollar-sign': DollarSign,
      'truck': Truck,
      'file-search': FileSearch,
    }
    const IconComponent = iconMap[icon || type] || FileText
    return <IconComponent className="h-4 w-4" />
  }

  const getActivityTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      'STOCK_ADJUSTMENT': 'Ajuste de Inventario',
      'PAYMENT': 'Pago Recibido',
      'CASH_MOVEMENT': 'Movimiento de Caja',
      'PRODUCT': 'Producto Nuevo',
      'INVOICE': 'Factura Creada',
      'PURCHASE_ORDER': 'Orden de Compra',
      'GOODS_RECEIPT': 'Recepción de Mercancía',
      'QUOTATION': 'Cotización',
      'CRM_ACTIVITY': 'Actividad CRM',
    }
    return labels[type] || type
  }

  const getActivityColor = (type: string, color?: string) => {
    const colorMap: Record<string, string> = {
      'STOCK_ADJUSTMENT': 'text-blue-600 bg-blue-50',
      'PAYMENT': 'text-green-600 bg-green-50',
      'CASH_MOVEMENT': 'text-purple-600 bg-purple-50',
      'PRODUCT': 'text-indigo-600 bg-indigo-50',
      'INVOICE': 'text-cyan-600 bg-cyan-50',
      'PURCHASE_ORDER': 'text-orange-600 bg-orange-50',
      'GOODS_RECEIPT': 'text-pink-600 bg-pink-50',
      'QUOTATION': 'text-teal-600 bg-teal-50',
      'CRM_ACTIVITY': 'text-gray-600 bg-gray-50',
      'green': 'text-green-600 bg-green-50',
      'red': 'text-red-600 bg-red-50',
      'blue': 'text-blue-600 bg-blue-50',
      'orange': 'text-orange-600 bg-orange-50',
      'purple': 'text-purple-600 bg-purple-50',
      'cyan': 'text-cyan-600 bg-cyan-50',
      'gray': 'text-gray-600 bg-gray-50',
    }
    return colorMap[color || type] || 'text-gray-600 bg-gray-50'
  }

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-800 bg-[#0F172A] text-slate-100 backdrop-blur supports-[backdrop-filter]:bg-[#0F172A]/95">
      <div className="flex h-14 sm:h-16 items-center justify-between px-3 sm:px-4 md:px-6">
        {/* Left side: Menu */}
        <div className="flex items-center gap-2 sm:gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={toggle}
            className="h-8 w-8 sm:h-9 sm:w-9 text-slate-100 hover:bg-slate-800 hover:text-white"
          >
            <Menu className="h-4 w-4 sm:h-5 sm:w-5" />
          </Button>
        </div>

        {/* Right side: Theme Toggle, Notifications and User */}
        <div className="flex items-center gap-1 sm:gap-2">
          {/* Theme Toggle */}
          <ThemeToggle />

          {/* Notifications */}
          <DropdownMenu open={isDropdownOpen} onOpenChange={handleDropdownOpenChange}>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="relative h-8 w-8 sm:h-9 sm:w-9 text-slate-100 hover:bg-slate-800 hover:text-white">
                <Bell className="h-4 w-4" />
                {hasUnreadNotifications && (
                  <span className="absolute top-0.5 right-0.5 sm:top-1 sm:right-1 h-2 w-2 bg-red-500 rounded-full"></span>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[calc(100vw-2rem)] sm:w-96 max-h-[600px] overflow-y-auto">
              <DropdownMenuLabel>Historial de Acciones</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {isLoadingActivities ? (
                <div className="p-4 text-center text-sm text-muted-foreground">
                  Cargando...
                </div>
              ) : activities.length === 0 ? (
                <div className="p-4 text-center text-sm text-muted-foreground">
                  No hay acciones registradas
                </div>
              ) : (
                <div className="max-h-[500px] overflow-y-auto">
                  {activities.map((activity: any) => (
                    <DropdownMenuItem
                      key={activity.id}
                      className="flex items-start gap-3 p-3 cursor-default focus:bg-accent"
                      onSelect={(e) => e.preventDefault()}
                    >
                      <div className={`flex-shrink-0 mt-0.5 p-1.5 rounded ${getActivityColor(activity.type, activity.color)}`}>
                        {getActivityIcon(activity.type, activity.icon)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-semibold text-muted-foreground mb-1">
                          {getActivityTypeLabel(activity.type)}
                        </div>
                        <div className="text-sm font-medium mb-1 truncate">
                          {activity.title}
                        </div>
                        {activity.description && (
                          <div className="text-xs text-muted-foreground mb-1 line-clamp-2">
                            {activity.description}
                          </div>
                        )}
                        <div className="text-xs text-muted-foreground">
                          {formatDateTime(activity.createdAt)} • {activity.user || 'Sistema'}
                        </div>
                      </div>
                    </DropdownMenuItem>
                  ))}
                </div>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* User Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="rounded-full h-8 w-8 sm:h-9 sm:w-9 text-slate-100 hover:bg-slate-800 hover:text-white">
                <User className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none">
                    {session?.user?.name || 'Usuario'}
                  </p>
                  <p className="text-xs leading-none text-muted-foreground">
                    {session?.user?.email || ''}
                  </p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => signOut({ callbackUrl: '/login' })}>
                Cerrar Sesión
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  )
}

