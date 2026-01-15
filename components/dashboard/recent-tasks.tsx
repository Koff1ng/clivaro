'use client'

import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCurrency, formatDate } from '@/lib/utils'
import { ClipboardList, ArrowUp, CheckCircle2, Paperclip } from 'lucide-react'

async function fetchRecentTasks() {
  const res = await fetch('/api/activities?limit=3&type=TASK')
  if (!res.ok) {
    return []
  }
  return res.json()
}

export function RecentTasks() {
  const { data, isLoading } = useQuery({
    queryKey: ['recent-tasks'],
    queryFn: fetchRecentTasks,
    staleTime: 2 * 60 * 1000,
  })

  const tasks = data || []

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5" />
            Tareas Recientes
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="p-2 animate-pulse">
                <div className="h-4 w-full bg-gray-200 rounded mb-2"></div>
                <div className="h-3 w-2/3 bg-gray-200 rounded"></div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  const getTaskIcon = (completed: boolean) => {
    if (completed) return <CheckCircle2 className="h-4 w-4 text-green-600" />
    return <ArrowUp className="h-4 w-4 text-blue-600" />
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ClipboardList className="h-5 w-5" />
          Tareas Recientes
        </CardTitle>
      </CardHeader>
      <CardContent>
        {tasks.length === 0 ? (
          <p className="text-sm text-muted-foreground">No hay tareas recientes</p>
        ) : (
          <div className="space-y-3">
            {tasks.map((task: any, index: number) => (
              <div key={task.id || index} className="flex items-start gap-3 p-2 hover:bg-accent rounded-lg transition-colors">
                <div className="mt-0.5">
                  {getTaskIcon(task.completed)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm">{task.subject}</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {task.lead?.name || task.customer?.name || 'Sin asignar'}
                  </div>
                  {task.expectedRevenue && (
                    <div className="text-xs text-muted-foreground">
                      {formatCurrency(task.expectedRevenue)}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

