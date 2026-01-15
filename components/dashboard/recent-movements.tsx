'use client'

import { useQuery } from '@tanstack/react-query'
import { formatDateTime } from '@/lib/utils'
import { 
  ArrowUpCircle, 
  ArrowDownCircle, 
  ArrowRightLeft,
  FileText,
  ShoppingCart,
  Package,
  Truck,
  FileSearch,
  Wallet,
  ClipboardList,
  UserPlus,
  Building,
  DollarSign,
  Phone,
  Mail,
  Calendar,
  CheckSquare,
} from 'lucide-react'

async function fetchActivityFeed() {
  const params = new URLSearchParams({
    limit: '30', // Últimas 30 actividades
  })
  
  const res = await fetch(`/api/activity-feed?${params}`, {
    credentials: 'include',
  })
  if (!res.ok) {
    const error = await res.json()
    throw new Error(error.error || 'Failed to fetch activity feed')
  }
  return res.json()
}

export function RecentMovements() {
  const { data, isLoading } = useQuery({
    queryKey: ['activity-feed'],
    queryFn: fetchActivityFeed,
    refetchInterval: 30 * 1000, // Refrescar cada 30 segundos (optimizado para mejor rendimiento)
    refetchOnWindowFocus: false, // No refrescar automáticamente al enfocar ventana
    refetchOnMount: true, // Refrescar al montar el componente
    staleTime: 15 * 1000, // 15 segundos - datos considerados frescos
    gcTime: 10 * 60 * 1000, // 10 minutos en cache
  })

  if (isLoading) {
    return (
      <div className="border rounded-lg p-4">
        <h3 className="font-semibold mb-3">Historial de Actividades</h3>
        <div className="text-sm text-gray-500">Cargando...</div>
      </div>
    )
  }

  const { activities = [] } = data || {}

  const getIcon = (iconName: string, color: string) => {
    const colorClass = getColorClass(color)
    const baseClass = 'h-4 w-4'
    switch (iconName) {
      case 'arrow-up-circle': return <ArrowUpCircle className={`${baseClass} ${colorClass}`} />
      case 'arrow-down-circle': return <ArrowDownCircle className={`${baseClass} ${colorClass}`} />
      case 'arrow-right-left': return <ArrowRightLeft className={`${baseClass} ${colorClass}`} />
      case 'file-text': return <FileText className={`${baseClass} ${colorClass}`} />
      case 'shopping-cart': return <ShoppingCart className={`${baseClass} ${colorClass}`} />
      case 'package': return <Package className={`${baseClass} ${colorClass}`} />
      case 'truck': return <Truck className={`${baseClass} ${colorClass}`} />
      case 'file-search': return <FileSearch className={`${baseClass} ${colorClass}`} />
      case 'cash-register': return <Wallet className={`${baseClass} ${colorClass}`} />
      case 'clipboard-list': return <ClipboardList className={`${baseClass} ${colorClass}`} />
      case 'user-plus': return <UserPlus className={`${baseClass} ${colorClass}`} />
      case 'building': return <Building className={`${baseClass} ${colorClass}`} />
      case 'dollar-sign': return <DollarSign className={`${baseClass} ${colorClass}`} />
      case 'phone': return <Phone className={`${baseClass} ${colorClass}`} />
      case 'mail': return <Mail className={`${baseClass} ${colorClass}`} />
      case 'calendar': return <Calendar className={`${baseClass} ${colorClass}`} />
      case 'check-square': return <CheckSquare className={`${baseClass} ${colorClass}`} />
      default: return <FileText className={`${baseClass} ${colorClass}`} />
    }
  }

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'STOCK_ADJUSTMENT': return 'Ajuste de Inventario'
      case 'PAYMENT': return 'Pago'
      case 'CASH_MOVEMENT': return 'Movimiento de Caja'
      case 'PRODUCT': return 'Producto Nuevo'
      case 'PURCHASE_ORDER': return 'Orden de Compra'
      case 'GOODS_RECEIPT': return 'Recepción'
      case 'QUOTATION': return 'Cotización'
      case 'CRM_ACTIVITY': return 'Actividad CRM'
      default: return type
    }
  }

  const getColorClass = (color: string) => {
    switch (color) {
      case 'green': return 'text-green-600'
      case 'red': return 'text-red-600'
      case 'blue': return 'text-blue-600'
      case 'orange': return 'text-orange-600'
      case 'purple': return 'text-purple-600'
      case 'cyan': return 'text-cyan-600'
      case 'indigo': return 'text-indigo-600'
      case 'amber': return 'text-amber-600'
      default: return 'text-gray-600'
    }
  }

  return (
    <div className="border rounded-lg p-4">
      <h3 className="font-semibold mb-3">Historial de Actividades</h3>
      {activities.length === 0 ? (
        <div className="text-sm text-gray-500">No hay actividades recientes</div>
      ) : (
        <div className="space-y-2 max-h-[500px] overflow-y-auto">
          {activities.map((activity: any) => (
            <div
              key={activity.id}
              className="flex items-start gap-3 p-3 rounded hover:bg-gray-50 border-b last:border-b-0"
            >
              <div className="flex-shrink-0 mt-0.5">
                {getIcon(activity.icon, activity.color)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-xs font-semibold ${getColorClass(activity.color)}`}>
                    {getTypeLabel(activity.type)}
                  </span>
                  {activity.completed && (
                    <span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded">
                      Completada
                    </span>
                  )}
                </div>
                <div className="font-medium text-sm mt-1">
                  {activity.title}
                </div>
                <div className="text-xs text-gray-600 mt-1">
                  {activity.description}
                </div>
                <div className="text-xs text-gray-400 mt-1">
                  {formatDateTime(activity.createdAt)} • {activity.user}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

