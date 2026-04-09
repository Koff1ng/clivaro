'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PageHeader } from '@/components/ui/page-header'
import {
  Headphones,
  Search,
  Loader2,
  Clock,
  Shield,
  AlertCircle,
  CheckCircle,
  MessageSquare,
  Eye,
  ChevronDown,
  Filter,
  Plus,
  Save,
  X,
} from 'lucide-react'
import { useToast } from '@/components/ui/toast'

export function AuditClient() {
  const [activeTab, setActiveTab] = useState<'logs' | 'tickets'>('logs')
  const [logSearch, setLogSearch] = useState('')
  const [logFilter, setLogFilter] = useState('')
  const [ticketFilter, setTicketFilter] = useState('')
  const [showNewTicket, setShowNewTicket] = useState(false)
  const { toast } = useToast()
  const queryClient = useQueryClient()

  // Audit Logs
  const { data: logsData, isLoading: logsLoading } = useQuery({
    queryKey: ['admin-audit-logs', logSearch, logFilter],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (logSearch) params.set('search', logSearch)
      if (logFilter) params.set('action', logFilter)
      const res = await fetch(`/api/admin/audit-logs?${params}`)
      if (!res.ok) throw new Error('Error al cargar logs')
      return res.json()
    },
    refetchInterval: 15000,
  })

  // Tickets
  const { data: tickets, isLoading: ticketsLoading } = useQuery({
    queryKey: ['admin-tickets', ticketFilter],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (ticketFilter) params.set('status', ticketFilter)
      const res = await fetch(`/api/admin/tickets?${params}`)
      if (!res.ok) throw new Error('Error al cargar tickets')
      return res.json()
    },
    refetchInterval: 30000,
  })

  const updateTicketMutation = useMutation({
    mutationFn: async ({ id, ...data }: any) => {
      const res = await fetch(`/api/admin/tickets/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      })
      if (!res.ok) throw new Error('Error al actualizar ticket')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-tickets'] })
      toast('Ticket actualizado', 'success')
    }
  })

  const createTicketMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch('/api/admin/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      })
      if (!res.ok) throw new Error('Error al crear ticket')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-tickets'] })
      setShowNewTicket(false)
      toast('Ticket creado', 'success')
    }
  })

  const logs = logsData?.logs || []
  const ticketsList = Array.isArray(tickets) ? tickets : []

  const getActionBadge = (action: string) => {
    const colors: Record<string, string> = {
      'IMPERSONATE_TENANT': 'bg-amber-500',
      'CREATE_TENANT': 'bg-green-600',
      'UPDATE_PLAN': 'bg-blue-600',
      'SUSPEND_TENANT': 'bg-red-600',
      'ENABLE_FEATURE': 'bg-emerald-600',
      'DISABLE_FEATURE': 'bg-gray-600',
      'UPDATE_TICKET': 'bg-indigo-600',
    }
    return <Badge className={colors[action] || 'bg-gray-500'}>{action.replace(/_/g, ' ')}</Badge>
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'OPEN': return <Badge className="bg-red-500">Abierto</Badge>
      case 'IN_PROGRESS': return <Badge className="bg-amber-500">En Progreso</Badge>
      case 'RESOLVED': return <Badge className="bg-green-600">Resuelto</Badge>
      case 'CLOSED': return <Badge variant="secondary">Cerrado</Badge>
      default: return <Badge variant="secondary">{status}</Badge>
    }
  }

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'CRITICAL': return <Badge variant="destructive">Crítico</Badge>
      case 'HIGH': return <Badge className="bg-orange-500">Alto</Badge>
      case 'MEDIUM': return <Badge variant="secondary">Medio</Badge>
      case 'LOW': return <Badge variant="outline">Bajo</Badge>
      default: return <Badge variant="secondary">{priority}</Badge>
    }
  }

  const formatDateTime = (date: string) => {
    try {
      return new Date(date).toLocaleString('es-CO', { 
        year: 'numeric', month: 'short', day: 'numeric',
        hour: '2-digit', minute: '2-digit', second: '2-digit'
      })
    } catch { return date }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Auditoría y Soporte"
        description="Logs de actividad de Super Admins y gestión de tickets de soporte."
        icon={<Headphones className="h-5 w-5" />}
      />

      {/* Tabs */}
      <div className="flex gap-2 border-b pb-0">
        <button
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'logs' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          onClick={() => setActiveTab('logs')}
        >
          <Shield className="h-4 w-4" />
          Activity Logs
        </button>
        <button
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'tickets' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          onClick={() => setActiveTab('tickets')}
        >
          <MessageSquare className="h-4 w-4" />
          Tickets de Soporte
          {ticketsList.filter((t: any) => t.status === 'OPEN').length > 0 && (
            <span className="bg-red-500 text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center">
              {ticketsList.filter((t: any) => t.status === 'OPEN').length}
            </span>
          )}
        </button>
      </div>

      {/* ACTIVITY LOGS TAB */}
      {activeTab === 'logs' && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Buscar por nombre, tenant..."
                value={logSearch}
                onChange={(e) => setLogSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <select
              className="px-3 py-2 border rounded-lg bg-background text-sm"
              value={logFilter}
              onChange={(e) => setLogFilter(e.target.value)}
            >
              <option value="">Todas las acciones</option>
              <option value="IMPERSONATE_TENANT">Impersonación</option>
              <option value="CREATE_TENANT">Crear Tenant</option>
              <option value="UPDATE_PLAN">Cambio de Plan</option>
              <option value="SUSPEND_TENANT">Suspensión</option>
              <option value="ENABLE_FEATURE">Habilitar Feature</option>
              <option value="DISABLE_FEATURE">Deshabilitar Feature</option>
            </select>
          </div>

          {/* Logs Table */}
          <Card>
            <CardContent className="p-0">
              {logsLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : logs.length === 0 ? (
                <div className="text-center py-12">
                  <Shield className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-muted-foreground">No hay registros de auditoría</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="text-left p-3 font-medium">Timestamp</th>
                        <th className="text-left p-3 font-medium">Acción</th>
                        <th className="text-left p-3 font-medium">Admin</th>
                        <th className="text-left p-3 font-medium">Tenant</th>
                        <th className="text-left p-3 font-medium">Detalles</th>
                        <th className="text-left p-3 font-medium">IP</th>
                      </tr>
                    </thead>
                    <tbody>
                      {logs.map((log: any) => (
                        <tr key={log.id} className="border-b hover:bg-muted/30 transition-colors">
                          <td className="p-3">
                            <span className="text-xs font-mono text-muted-foreground">
                              {formatDateTime(log.createdAt)}
                            </span>
                          </td>
                          <td className="p-3">{getActionBadge(log.action)}</td>
                          <td className="p-3 font-medium">{log.adminUserName}</td>
                          <td className="p-3 text-muted-foreground">{log.targetTenantName || '—'}</td>
                          <td className="p-3">
                            {log.details && (
                              <span className="text-xs text-muted-foreground truncate block max-w-[200px]">
                                {(() => {
                                  try {
                                    const d = JSON.parse(log.details)
                                    return Object.entries(d).map(([k, v]) => `${k}: ${v}`).join(', ')
                                  } catch { return log.details }
                                })()}
                              </span>
                            )}
                          </td>
                          <td className="p-3">
                            <span className="text-xs font-mono text-muted-foreground">{log.ipAddress || '—'}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          {logsData?.pagination && logsData.pagination.totalPages > 1 && (
            <p className="text-xs text-muted-foreground text-center">
              Mostrando {logs.length} de {logsData.pagination.total} registros
            </p>
          )}
        </div>
      )}

      {/* TICKETS TAB */}
      {activeTab === 'tickets' && (
        <div className="space-y-4">
          {/* Header */}
          <div className="flex justify-between items-center">
            <div className="flex gap-2">
              <select
                className="px-3 py-2 border rounded-lg bg-background text-sm"
                value={ticketFilter}
                onChange={(e) => setTicketFilter(e.target.value)}
              >
                <option value="">Todos los estados</option>
                <option value="OPEN">Abiertos</option>
                <option value="IN_PROGRESS">En Progreso</option>
                <option value="RESOLVED">Resueltos</option>
                <option value="CLOSED">Cerrados</option>
              </select>
            </div>
            <Button onClick={() => setShowNewTicket(true)} className="bg-gradient-to-r from-blue-600 to-indigo-600">
              <Plus className="h-4 w-4 mr-2" />
              Crear Ticket
            </Button>
          </div>

          {/* New Ticket Form */}
          {showNewTicket && (
            <Card className="border-blue-200 dark:border-blue-800">
              <CardHeader>
                <CardTitle className="text-sm">Nuevo Ticket de Soporte</CardTitle>
              </CardHeader>
              <CardContent>
                <TicketForm
                  onCancel={() => setShowNewTicket(false)}
                  onSubmit={(data: any) => createTicketMutation.mutate(data)}
                  isLoading={createTicketMutation.isPending}
                />
              </CardContent>
            </Card>
          )}

          {/* Stats */}
          <div className="grid grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-red-500">
                  {ticketsList.filter((t: any) => t.status === 'OPEN').length}
                </div>
                <p className="text-xs text-muted-foreground">Abiertos</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-amber-500">
                  {ticketsList.filter((t: any) => t.status === 'IN_PROGRESS').length}
                </div>
                <p className="text-xs text-muted-foreground">En Progreso</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-green-500">
                  {ticketsList.filter((t: any) => t.status === 'RESOLVED').length}
                </div>
                <p className="text-xs text-muted-foreground">Resueltos</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold">
                  {ticketsList.filter((t: any) => t.priority === 'CRITICAL').length}
                </div>
                <p className="text-xs text-muted-foreground">Críticos</p>
              </CardContent>
            </Card>
          </div>

          {/* Tickets List */}
          {ticketsLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : ticketsList.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <MessageSquare className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                <p className="text-muted-foreground">No hay tickets de soporte</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {ticketsList.map((ticket: any) => (
                <Card key={ticket.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          {getStatusBadge(ticket.status)}
                          {getPriorityBadge(ticket.priority)}
                          {ticket.category && <Badge variant="outline" className="text-xs">{ticket.category}</Badge>}
                        </div>
                        <h3 className="font-medium text-sm truncate">{ticket.subject}</h3>
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{ticket.description}</p>
                        <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                          {ticket.tenantName && (
                            <span className="flex items-center gap-1">
                              <AlertCircle className="h-3 w-3" />
                              {ticket.tenantName}
                            </span>
                          )}
                          {ticket.reportedBy && <span>Por: {ticket.reportedBy}</span>}
                          <span>{formatDateTime(ticket.createdAt)}</span>
                          {ticket.userAgent && (
                            <span className="truncate max-w-[200px]" title={ticket.userAgent}>
                              {ticket.userAgent.slice(0, 50)}...
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-1 flex-shrink-0">
                        {ticket.status === 'OPEN' && (
                          <Button
                            variant="outline" size="sm"
                            onClick={() => updateTicketMutation.mutate({ id: ticket.id, status: 'IN_PROGRESS' })}
                          >
                            Tomar
                          </Button>
                        )}
                        {ticket.status === 'IN_PROGRESS' && (
                          <Button
                            variant="outline" size="sm"
                            className="text-green-600 border-green-300"
                            onClick={() => updateTicketMutation.mutate({ id: ticket.id, status: 'RESOLVED' })}
                          >
                            Resolver
                          </Button>
                        )}
                        {(ticket.status === 'RESOLVED') && (
                          <Button
                            variant="outline" size="sm"
                            onClick={() => updateTicketMutation.mutate({ id: ticket.id, status: 'CLOSED' })}
                          >
                            Cerrar
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function TicketForm({ onCancel, onSubmit, isLoading }: { onCancel: () => void; onSubmit: (data: any) => void; isLoading: boolean }) {
  const [formData, setFormData] = useState({
    subject: '',
    description: '',
    priority: 'MEDIUM',
    category: 'BUG',
    reportedBy: '',
    reportedEmail: '',
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit(formData)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label>Asunto *</Label>
        <Input
          value={formData.subject}
          onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
          placeholder="Describe brevemente el problema"
          required
        />
      </div>
      <div>
        <Label>Descripción *</Label>
        <textarea
          className="w-full px-3 py-2 border rounded-lg min-h-[100px] bg-background"
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          placeholder="Descripción detallada del problema..."
          required
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Prioridad</Label>
          <select
            className="w-full px-3 py-2 border rounded-lg bg-background"
            value={formData.priority}
            onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
          >
            <option value="LOW">Baja</option>
            <option value="MEDIUM">Media</option>
            <option value="HIGH">Alta</option>
            <option value="CRITICAL">Crítica</option>
          </select>
        </div>
        <div>
          <Label>Categoría</Label>
          <select
            className="w-full px-3 py-2 border rounded-lg bg-background"
            value={formData.category}
            onChange={(e) => setFormData({ ...formData, category: e.target.value })}
          >
            <option value="BUG">Bug</option>
            <option value="FEATURE_REQUEST">Solicitud de Funcionalidad</option>
            <option value="QUESTION">Pregunta</option>
            <option value="BILLING">Facturación</option>
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Reportado Por</Label>
          <Input
            value={formData.reportedBy}
            onChange={(e) => setFormData({ ...formData, reportedBy: e.target.value })}
            placeholder="Nombre"
          />
        </div>
        <div>
          <Label>Email</Label>
          <Input
            type="email"
            value={formData.reportedEmail}
            onChange={(e) => setFormData({ ...formData, reportedEmail: e.target.value })}
            placeholder="email@empresa.com"
          />
        </div>
      </div>
      <div className="flex gap-2 pt-2">
        <Button type="submit" disabled={isLoading} className="bg-gradient-to-r from-blue-600 to-indigo-600">
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
          Crear Ticket
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>
          <X className="h-4 w-4 mr-2" />
          Cancelar
        </Button>
      </div>
    </form>
  )
}
