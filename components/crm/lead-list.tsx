'use client'

import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { LeadForm } from './lead-form'
import { LeadDetails } from './lead-details'
import { LeadDashboard } from './lead-dashboard'
import { LeadKanban } from './lead-kanban'
import { formatCurrency } from '@/lib/utils'
import { Search, Plus, Edit, Trash2, Eye, Filter, LayoutGrid, BarChart3, Loader2 } from 'lucide-react'

async function fetchLeads(page: number, search: string, stage: string, assignedToId: string) {
  const params = new URLSearchParams({
    page: page.toString(),
    limit: '50',
  })
  if (search) params.append('search', search)
  if (stage) params.append('stage', stage)
  if (assignedToId) params.append('assignedToId', assignedToId)
  
  const res = await fetch(`/api/leads?${params}`)
  if (!res.ok) throw new Error('Failed to fetch leads')
  return res.json()
}

async function fetchUsers() {
  const res = await fetch('/api/admin/users')
  if (!res.ok) return []
  const data = await res.json()
  return data.users || []
}

export function LeadList() {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [stageFilter, setStageFilter] = useState('')
  const [assignedFilter, setAssignedFilter] = useState('')
  const [viewMode, setViewMode] = useState<'list' | 'kanban' | 'dashboard'>('list')
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [selectedLead, setSelectedLead] = useState<any>(null)
  const [viewLead, setViewLead] = useState<any>(null)
  const queryClient = useQueryClient()

  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: fetchUsers,
  })

  const { data, isLoading } = useQuery({
    queryKey: ['leads', page, search, stageFilter, assignedFilter],
    queryFn: () => fetchLeads(page, search, stageFilter, assignedFilter),
    staleTime: 0, // Siempre considerar los datos como obsoletos para ver oportunidades nuevas
    refetchOnWindowFocus: true, // Refrescar cuando la ventana recupera el foco
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/leads/${id}`, {
        method: 'DELETE',
      })
      if (!res.ok) throw new Error('Failed to delete lead')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] })
    },
  })

  const handleEdit = (lead: any) => {
    setSelectedLead(lead)
    setIsFormOpen(true)
  }

  const handleDelete = async (lead: any) => {
    if (confirm(`¿Estás seguro de eliminar la oportunidad "${lead.name}"?`)) {
      await deleteMutation.mutateAsync(lead.id)
    }
  }

  const handleView = async (lead: any) => {
    const res = await fetch(`/api/leads/${lead.id}`)
    const data = await res.json()
    setViewLead(data)
  }

  const getStageColor = (stage: string) => {
    switch (stage) {
      case 'NEW': return 'bg-blue-100 text-blue-800'
      case 'CONTACTED': return 'bg-yellow-100 text-yellow-800'
      case 'QUOTED': return 'bg-purple-100 text-purple-800'
      case 'WON': return 'bg-green-100 text-green-800'
      case 'LOST': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getStageLabel = (stage: string) => {
    const labels: Record<string, string> = {
      NEW: 'Nueva',
      CONTACTED: 'Contactado',
      QUOTED: 'Cotizado',
      WON: 'Ganada',
      LOST: 'Perdida',
    }
    return labels[stage] || stage
  }

  const { leads = [], pagination = { totalPages: 1, page: 1, total: 0 } } = useMemo(() => {
    return data || { leads: [], pagination: { totalPages: 1, page: 1, total: 0 } }
  }, [data])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Buscar oportunidades..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
            className="pl-10"
          />
        </div>
        <div className="flex gap-2">
          <select
            value={stageFilter}
            onChange={(e) => {
              setStageFilter(e.target.value)
              setPage(1)
            }}
            className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="">Todos los estados</option>
            <option value="NEW">Nueva</option>
            <option value="CONTACTED">Contactado</option>
            <option value="QUOTED">Cotizado</option>
            <option value="WON">Ganada</option>
            <option value="LOST">Perdida</option>
          </select>
          <select
            value={assignedFilter}
            onChange={(e) => {
              setAssignedFilter(e.target.value)
              setPage(1)
            }}
            className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="">Todos los usuarios</option>
            {users.map((user: any) => (
              <option key={user.id} value={user.id}>{user.name}</option>
            ))}
          </select>
        </div>
        <div className="flex gap-2">
          <Button
            variant={viewMode === 'list' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('list')}
          >
            Lista
          </Button>
          <Button
            variant={viewMode === 'kanban' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('kanban')}
          >
            <LayoutGrid className="h-4 w-4 mr-2" />
            Kanban
          </Button>
          <Button
            variant={viewMode === 'dashboard' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('dashboard')}
          >
            <BarChart3 className="h-4 w-4 mr-2" />
            Dashboard
          </Button>
          <Button onClick={() => {
            setSelectedLead(null)
            setIsFormOpen(true)
          }}>
            <Plus className="h-4 w-4 mr-2" />
            Nueva Oportunidad
          </Button>
        </div>
      </div>

      {viewMode === 'dashboard' && (
        <LeadDashboard leads={leads} />
      )}

      {viewMode === 'kanban' && (
        <LeadKanban
          leads={leads}
          users={users}
          queryKey={['leads', page, search, stageFilter, assignedFilter]}
          onLeadClick={handleView}
        />
      )}

      {viewMode === 'list' && (
        <>
          {isLoading && leads.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground mr-2" />
              <span className="text-muted-foreground">Cargando oportunidades...</span>
            </div>
          ) : (
          <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Empresa</TableHead>
              <TableHead>Contacto</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Probabilidad</TableHead>
              <TableHead>Ingreso Esperado</TableHead>
              <TableHead>Valor Ponderado</TableHead>
              <TableHead>Fecha Cierre</TableHead>
              <TableHead>Asignado a</TableHead>
              <TableHead>Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {leads.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center text-gray-500">
                  No hay oportunidades
                </TableCell>
              </TableRow>
            ) : (
              leads.map((lead: any) => (
                <TableRow key={lead.id}>
                  <TableCell className="font-medium">{lead.name}</TableCell>
                  <TableCell>{lead.company || '-'}</TableCell>
                  <TableCell>
                    <div className="text-sm">
                      {lead.email && <div>{lead.email}</div>}
                      {lead.phone && <div className="text-gray-500">{lead.phone}</div>}
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className={`px-2 py-1 text-xs rounded ${getStageColor(lead.stage)}`}>
                      {getStageLabel(lead.stage)}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-blue-600 h-2 rounded-full"
                          style={{ width: `${lead.probability || 0}%` }}
                        />
                      </div>
                      <span className="text-xs text-gray-600">{lead.probability || 0}%</span>
                    </div>
                  </TableCell>
                  <TableCell>{formatCurrency(lead.expectedRevenue || 0)}</TableCell>
                  <TableCell className="font-semibold text-blue-600">
                    {formatCurrency((lead.expectedRevenue || 0) * ((lead.probability || 0) / 100))}
                  </TableCell>
                  <TableCell>
                    {lead.expectedCloseDate ? new Date(lead.expectedCloseDate).toLocaleDateString('es-ES') : '-'}
                  </TableCell>
                  <TableCell>{lead.assignedTo?.name || 'Sin asignar'}</TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleView(lead)}
                        title="Ver detalles"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(lead)}
                        title="Editar"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(lead)}
                        title="Eliminar"
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
          )}

      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-600">
            Página {pagination.page} de {pagination.totalPages} ({pagination.total} oportunidades)
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              Anterior
            </Button>
            <Button
              variant="outline"
              onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))}
              disabled={page === pagination.totalPages}
            >
              Siguiente
            </Button>
          </div>
        </div>
      )}
        </>
      )}

      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedLead ? 'Editar Oportunidad' : 'Nueva Oportunidad'}
            </DialogTitle>
          </DialogHeader>
          <LeadForm
            lead={selectedLead}
            users={users}
            onSuccess={() => {
              setIsFormOpen(false)
              setSelectedLead(null)
              // Forzar refetch de la lista después de crear/editar
              queryClient.refetchQueries({ queryKey: ['leads'] })
            }}
          />
        </DialogContent>
      </Dialog>

      {viewLead && (
        <Dialog open={!!viewLead} onOpenChange={() => setViewLead(null)}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Detalles de la Oportunidad</DialogTitle>
            </DialogHeader>
            <LeadDetails lead={viewLead} />
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}

