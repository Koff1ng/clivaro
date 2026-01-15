'use client'

import { useQuery } from '@tanstack/react-query'
import { formatDateTime } from '@/lib/utils'
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
  TrendingDown
} from 'lucide-react'

async function fetchActivityFeed() {
  const res = await fetch('/api/activity-feed?limit=20')
  if (!res.ok) throw new Error('Failed to fetch activity feed')
  return res.json()
}

export function ActionHistory() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['activity-feed'],
    queryFn: fetchActivityFeed,
    refetchInterval: 30 * 1000, // Refrescar cada 30 segundos
    staleTime: 0,
  })

  const activities = data?.activities || []

  if (isLoading) {
    return (
      <div className="border rounded-lg p-4 bg-card">
        <h3 className="font-semibold mb-3 text-lg">Historial de Acciones</h3>
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex items-start gap-3 p-3 rounded border animate-pulse">
              <div className="w-5 h-5 bg-gray-200 rounded"></div>
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                <div className="h-3 bg-gray-200 rounded w-1/2"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="border rounded-lg p-4 bg-card">
        <h3 className="font-semibold mb-3 text-lg">Historial de Acciones</h3>
        <div className="text-sm text-red-600">
          Error al cargar el historial: {error instanceof Error ? error.message : 'Error desconocido'}
        </div>
      </div>
    )
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
    return <IconComponent className="h-5 w-5" />
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
    <div className="border rounded-lg p-4 bg-card">
      <h3 className="font-semibold mb-4 text-lg">Historial de Acciones</h3>
      {activities.length === 0 ? (
        <div className="text-sm text-muted-foreground text-center py-8">
          No hay acciones registradas
        </div>
      ) : (
        <div className="space-y-2 max-h-[600px] overflow-y-auto">
          {activities.map((activity: any) => (
            <div
              key={activity.id}
              className="flex items-start gap-3 p-3 rounded-lg hover:bg-accent/50 transition-colors border-b last:border-b-0"
            >
              <div className={`flex-shrink-0 mt-0.5 p-1.5 rounded ${getActivityColor(activity.type, activity.color)}`}>
                {getActivityIcon(activity.type, activity.icon)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className="text-xs font-semibold text-muted-foreground">
                    {getActivityTypeLabel(activity.type)}
                  </span>
                  {activity.completed && (
                    <span className="text-xs bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 px-2 py-0.5 rounded">
                      Completada
                    </span>
                  )}
                </div>
                <div className="font-medium text-sm mb-1">
                  {activity.title}
                </div>
                {activity.description && (
                  <div className="text-xs text-muted-foreground mb-2 line-clamp-2">
                    {activity.description}
                  </div>
                )}
                <div className="text-xs text-muted-foreground">
                  {formatDateTime(activity.createdAt)} • {activity.user || 'Sistema'}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

