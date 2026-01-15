'use client'

import { useQuery } from '@tanstack/react-query'
import { formatDateTime } from '@/lib/utils'
import { Phone, Mail, Calendar, CheckSquare, FileText } from 'lucide-react'

async function fetchActivities() {
  const res = await fetch('/api/activities')
  if (!res.ok) throw new Error('Failed to fetch activities')
  return res.json()
}

export function ActivityHistory() {
  const { data: activities = [], isLoading } = useQuery({
    queryKey: ['activities'],
    queryFn: fetchActivities,
    refetchInterval: 30000, // Refrescar cada 30 segundos
  })

  if (isLoading) {
    return (
      <div className="border rounded-lg p-4">
        <h3 className="font-semibold mb-3">Historial de Actividades</h3>
        <div className="text-sm text-gray-500">Cargando...</div>
      </div>
    )
  }

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'CALL': return <Phone className="h-4 w-4 text-blue-600" />
      case 'EMAIL': return <Mail className="h-4 w-4 text-green-600" />
      case 'MEETING': return <Calendar className="h-4 w-4 text-purple-600" />
      case 'TASK': return <CheckSquare className="h-4 w-4 text-orange-600" />
      case 'NOTE': return <FileText className="h-4 w-4 text-gray-600" />
      default: return <FileText className="h-4 w-4 text-gray-600" />
    }
  }

  const getActivityTypeLabel = (type: string) => {
    switch (type) {
      case 'CALL': return 'Llamada'
      case 'EMAIL': return 'Email'
      case 'MEETING': return 'Reunión'
      case 'TASK': return 'Tarea'
      case 'NOTE': return 'Nota'
      default: return type
    }
  }

  const getActivityTypeColor = (type: string) => {
    switch (type) {
      case 'CALL': return 'text-blue-600'
      case 'EMAIL': return 'text-green-600'
      case 'MEETING': return 'text-purple-600'
      case 'TASK': return 'text-orange-600'
      case 'NOTE': return 'text-gray-600'
      default: return 'text-gray-600'
    }
  }

  return (
    <div className="border rounded-lg p-4">
      <h3 className="font-semibold mb-3">Historial de Actividades</h3>
      {activities.length === 0 ? (
        <div className="text-sm text-gray-500">No hay actividades registradas</div>
      ) : (
        <div className="space-y-2 max-h-[500px] overflow-y-auto">
          {activities.map((activity: any) => (
            <div
              key={activity.id}
              className="flex items-start gap-3 p-3 rounded hover:bg-gray-50 border-b last:border-b-0"
            >
              <div className="flex-shrink-0 mt-0.5">
                {getActivityIcon(activity.type)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-xs font-semibold ${getActivityTypeColor(activity.type)}`}>
                    {getActivityTypeLabel(activity.type)}
                  </span>
                  {activity.completed && (
                    <span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded">
                      Completada
                    </span>
                  )}
                </div>
                <div className="font-medium text-sm mt-1">
                  {activity.subject}
                </div>
                {activity.description && (
                  <div className="text-xs text-gray-600 mt-1 line-clamp-2">
                    {activity.description}
                  </div>
                )}
                <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
                  {activity.lead && (
                    <span>Lead: {activity.lead.name}</span>
                  )}
                  {activity.customer && (
                    <span>Cliente: {activity.customer.name}</span>
                  )}
                  {activity.dueDate && (
                    <span>Vence: {formatDateTime(activity.dueDate)}</span>
                  )}
                </div>
                <div className="text-xs text-gray-400 mt-1">
                  {formatDateTime(activity.createdAt)} • {activity.createdBy?.name || 'Sistema'}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

