'use client'

import { useState, useMemo, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  DragDropContext,
  Droppable,
  Draggable,
  DropResult,
} from '@hello-pangea/dnd'
import {
  Plus, Search, Filter, Loader2, Phone, DollarSign, Calendar,
  User, MoreVertical, Trash2, Edit, GripVertical, Target,
  TrendingUp, MessageCircle, ArrowRight
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter
} from '@/components/ui/dialog'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { PageHeader } from '@/components/ui/page-header'
import OpportunityDetailPanel from '@/components/marketing/opportunity-detail-panel'

interface Stage {
  id: string
  name: string
  color: string
  order: number
  isDefault: boolean
  isWon: boolean
  isLost: boolean
  _count: { opportunities: number }
}

interface Opportunity {
  id: string
  title: string
  description?: string
  value: number
  probability: number
  expectedCloseDate?: string
  priority: string
  source?: string
  contactPhone?: string
  notes?: string
  order: number
  stageId: string
  pipelineStage?: Stage
  customer?: { id: string; name: string; phone?: string; email?: string }
  _count: { activities: number }
  createdAt: string
}

const PRIORITY_COLORS: Record<string, string> = {
  LOW: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  MEDIUM: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  HIGH: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300',
  URGENT: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
}

const PRIORITY_LABELS: Record<string, string> = {
  LOW: 'Baja',
  MEDIUM: 'Media',
  HIGH: 'Alta',
  URGENT: 'Urgente',
}

const SOURCE_LABELS: Record<string, string> = {
  WEB: 'Web',
  WHATSAPP: 'WhatsApp',
  REFERRAL: 'Referido',
  WALK_IN: 'Presencial',
  PHONE: 'Teléfono',
}

function formatCurrency(n: number) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n)
}

function formatShortDate(d: string) {
  return new Date(d).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })
}

export default function OpportunitiesBoard() {
  const [search, setSearch] = useState('')
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [editingOpp, setEditingOpp] = useState<Opportunity | null>(null)
  const [selectedOppId, setSelectedOppId] = useState<string | null>(null)
  const queryClient = useQueryClient()

  // Queries
  const { data: stages = [], isLoading: loadingStages } = useQuery<Stage[]>({
    queryKey: ['pipeline-stages'],
    queryFn: async () => {
      const res = await fetch('/api/marketing/pipeline-stages')
      if (!res.ok) throw new Error('Failed')
      return res.json()
    },
  })

  const { data: opportunities = [], isLoading: loadingOpps } = useQuery<Opportunity[]>({
    queryKey: ['opportunities', search],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (search) params.set('search', search)
      const res = await fetch(`/api/marketing/opportunities?${params}`)
      if (!res.ok) throw new Error('Failed')
      return res.json()
    },
  })

  // Mutations
  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch('/api/marketing/opportunities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Error') }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['opportunities'] })
      queryClient.invalidateQueries({ queryKey: ['pipeline-stages'] })
      setShowCreateDialog(false)
    },
  })

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...data }: any) => {
      const res = await fetch(`/api/marketing/opportunities/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Error') }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['opportunities'] })
      queryClient.invalidateQueries({ queryKey: ['pipeline-stages'] })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/marketing/opportunities/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Error')
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['opportunities'] })
      queryClient.invalidateQueries({ queryKey: ['pipeline-stages'] })
    },
  })

  // Group opportunities by stage
  const oppsByStage = useMemo(() => {
    const map: Record<string, Opportunity[]> = {}
    stages.forEach(s => { map[s.id] = [] })
    opportunities.forEach(opp => {
      if (map[opp.stageId]) map[opp.stageId].push(opp)
    })
    // Sort within each column by order
    Object.values(map).forEach(arr => arr.sort((a, b) => a.order - b.order))
    return map
  }, [opportunities, stages])

  // Pipeline totals
  const pipelineTotal = useMemo(() => {
    return opportunities
      .filter(o => !o.pipelineStage?.isLost)
      .reduce((sum, o) => sum + o.value, 0)
  }, [opportunities])

  // Drag and Drop handler
  const onDragEnd = useCallback((result: DropResult) => {
    const { destination, source, draggableId } = result
    if (!destination) return
    if (destination.droppableId === source.droppableId && destination.index === source.index) return

    // Optimistic update
    const opp = opportunities.find(o => o.id === draggableId)
    if (!opp) return

    updateMutation.mutate({
      id: draggableId,
      stageId: destination.droppableId,
      order: destination.index,
    })
  }, [opportunities, updateMutation])

  const loading = loadingStages || loadingOpps

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-background/95 backdrop-blur-sm">
        <div className="flex items-center gap-4">
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2">
              <Target className="h-5 w-5 text-indigo-500" />
              Pipeline de Oportunidades
            </h1>
            <p className="text-xs text-muted-foreground">
              {opportunities.length} oportunidades · {formatCurrency(pipelineTotal)} en pipeline
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar..."
              className="pl-9 h-9 w-52"
            />
          </div>
          <Button onClick={() => setShowCreateDialog(true)} size="sm">
            <Plus className="h-4 w-4 mr-1" /> Nueva
          </Button>
        </div>
      </div>

      {/* Kanban Board */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : stages.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-muted-foreground">
          No hay etapas configuradas. Contacta al administrador.
        </div>
      ) : (
        <DragDropContext onDragEnd={onDragEnd}>
          <div className="flex-1 overflow-x-auto overflow-y-hidden">
            <div className="flex gap-3 p-4 h-full min-w-max">
              {stages.map((stage) => (
                <div key={stage.id} className="flex flex-col w-[300px] min-w-[300px]">
                  {/* Column Header */}
                  <div
                    className="flex items-center justify-between px-3 py-2.5 rounded-t-lg border border-b-2"
                    style={{ borderBottomColor: stage.color }}
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: stage.color }} />
                      <span className="font-semibold text-sm">{stage.name}</span>
                      <Badge variant="secondary" className="h-5 px-1.5 text-xs">
                        {oppsByStage[stage.id]?.length || 0}
                      </Badge>
                    </div>
                    <span className="text-xs text-muted-foreground font-medium">
                      {formatCurrency(
                        (oppsByStage[stage.id] || []).reduce((s, o) => s + o.value, 0)
                      )}
                    </span>
                  </div>

                  {/* Droppable Column */}
                  <Droppable droppableId={stage.id}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        className={`flex-1 overflow-y-auto space-y-2 p-2 rounded-b-lg border border-t-0 transition-colors ${
                          snapshot.isDraggingOver
                            ? 'bg-indigo-50/50 dark:bg-indigo-950/20 border-indigo-200 dark:border-indigo-800'
                            : 'bg-muted/30'
                        }`}
                        style={{ minHeight: 200 }}
                      >
                        {(oppsByStage[stage.id] || []).map((opp, index) => (
                          <Draggable key={opp.id} draggableId={opp.id} index={index}>
                            {(provided, snapshot) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                {...provided.dragHandleProps}
                                className={`group ${snapshot.isDragging ? 'rotate-2 shadow-lg' : ''}`}
                              >
                                <OpportunityCard
                                  opportunity={opp}
                                  onClick={() => setSelectedOppId(opp.id)}
                                  onEdit={() => setEditingOpp(opp)}
                                  onDelete={() => {
                                    if (confirm('¿Eliminar esta oportunidad?')) {
                                      deleteMutation.mutate(opp.id)
                                    }
                                  }}
                                />
                              </div>
                            )}
                          </Draggable>
                        ))}
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>
                </div>
              ))}
            </div>
          </div>
        </DragDropContext>
      )}

      {/* Create Dialog */}
      <OpportunityFormDialog
        open={showCreateDialog}
        onClose={() => setShowCreateDialog(false)}
        onSubmit={(data) => createMutation.mutate(data)}
        isLoading={createMutation.isPending}
        stages={stages}
      />

      {/* Edit Dialog */}
      {editingOpp && (
        <OpportunityFormDialog
          open={true}
          onClose={() => setEditingOpp(null)}
          onSubmit={(data) => updateMutation.mutate({ id: editingOpp.id, ...data })}
          isLoading={updateMutation.isPending}
          stages={stages}
          defaultValues={editingOpp}
        />
      )}

      {/* Detail Panel */}
      {selectedOppId && (
        <OpportunityDetailPanel
          opportunityId={selectedOppId}
          stages={stages}
          onClose={() => setSelectedOppId(null)}
        />
      )}
    </div>
  )
}

// ─── Opportunity Card ────────────────────────────────────
function OpportunityCard({
  opportunity: opp,
  onClick,
  onEdit,
  onDelete,
}: {
  opportunity: Opportunity
  onClick: () => void
  onEdit: () => void
  onDelete: () => void
}) {
  return (
    <Card className="shadow-sm hover:shadow-md transition-shadow cursor-grab active:cursor-grabbing border-l-[3px]"
      style={{ borderLeftColor: opp.pipelineStage?.color || '#6366f1' }}
      onClick={onClick}
    >
      <CardContent className="p-3 space-y-2">
        {/* Title + Menu */}
        <div className="flex items-start justify-between gap-1">
          <h3 className="font-medium text-sm leading-tight line-clamp-2">{opp.title}</h3>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 hover:bg-muted rounded">
                <MoreVertical className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-36">
              <DropdownMenuItem onClick={onEdit}>
                <Edit className="h-3.5 w-3.5 mr-2" /> Editar
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onDelete} className="text-red-600">
                <Trash2 className="h-3.5 w-3.5 mr-2" /> Eliminar
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Customer */}
        {opp.customer && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <User className="h-3 w-3" />
            <span className="truncate">{opp.customer.name}</span>
          </div>
        )}

        {/* Value + Priority */}
        <div className="flex items-center justify-between">
          {opp.value > 0 && (
            <span className="text-sm font-semibold text-green-600 dark:text-green-400 flex items-center gap-1">
              <DollarSign className="h-3.5 w-3.5" />
              {formatCurrency(opp.value)}
            </span>
          )}
          <Badge className={`text-[10px] px-1.5 py-0 ${PRIORITY_COLORS[opp.priority] || ''}`}>
            {PRIORITY_LABELS[opp.priority] || opp.priority}
          </Badge>
        </div>

        {/* Bottom row: phone, date, source */}
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
          {opp.contactPhone && (
            <span className="flex items-center gap-0.5">
              <MessageCircle className="h-3 w-3 text-green-500" />
              {opp.contactPhone.slice(-4)}
            </span>
          )}
          {opp.expectedCloseDate && (
            <span className="flex items-center gap-0.5">
              <Calendar className="h-3 w-3" />
              {formatShortDate(opp.expectedCloseDate)}
            </span>
          )}
          {opp.source && (
            <Badge variant="outline" className="text-[10px] px-1 py-0 h-4">
              {SOURCE_LABELS[opp.source] || opp.source}
            </Badge>
          )}
          <span className="ml-auto">{opp.probability}%</span>
        </div>
      </CardContent>
    </Card>
  )
}

// ─── Create/Edit Form Dialog ─────────────────────────────
function OpportunityFormDialog({
  open,
  onClose,
  onSubmit,
  isLoading,
  stages,
  defaultValues,
}: {
  open: boolean
  onClose: () => void
  onSubmit: (data: any) => void
  isLoading: boolean
  stages: Stage[]
  defaultValues?: Partial<Opportunity>
}) {
  const [title, setTitle] = useState(defaultValues?.title || '')
  const [value, setValue] = useState(String(defaultValues?.value || ''))
  const [probability, setProbability] = useState(String(defaultValues?.probability || 50))
  const [priority, setPriority] = useState(defaultValues?.priority || 'MEDIUM')
  const [source, setSource] = useState(defaultValues?.source || '')
  const [contactPhone, setContactPhone] = useState(defaultValues?.contactPhone || '')
  const [stageId, setStageId] = useState(defaultValues?.stageId || '')
  const [expectedClose, setExpectedClose] = useState(
    defaultValues?.expectedCloseDate ? String(defaultValues.expectedCloseDate).split('T')[0] : ''
  )
  const [notes, setNotes] = useState(defaultValues?.notes || '')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return
    onSubmit({
      title: title.trim(),
      value: parseFloat(value) || 0,
      probability: parseInt(probability) || 50,
      priority,
      source: source || null,
      contactPhone: contactPhone || null,
      stageId: stageId || undefined,
      expectedClose: expectedClose || null,
      notes: notes || null,
    })
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{defaultValues ? 'Editar Oportunidad' : 'Nueva Oportunidad'}</DialogTitle>
          <DialogDescription className="sr-only">
            {defaultValues ? 'Editar oportunidad existente' : 'Crear nueva oportunidad'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Título *</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ej: Venta de productos a Ferretería ABC" autoFocus />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Valor (COP)</Label>
              <Input type="number" value={value} onChange={(e) => setValue(e.target.value)} placeholder="0" />
            </div>
            <div className="space-y-2">
              <Label>Probabilidad (%)</Label>
              <Input type="number" min={0} max={100} value={probability} onChange={(e) => setProbability(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Prioridad</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="LOW">Baja</SelectItem>
                  <SelectItem value="MEDIUM">Media</SelectItem>
                  <SelectItem value="HIGH">Alta</SelectItem>
                  <SelectItem value="URGENT">Urgente</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Fuente</Label>
              <Select value={source} onValueChange={setSource}>
                <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="WEB">Web</SelectItem>
                  <SelectItem value="WHATSAPP">WhatsApp</SelectItem>
                  <SelectItem value="REFERRAL">Referido</SelectItem>
                  <SelectItem value="WALK_IN">Presencial</SelectItem>
                  <SelectItem value="PHONE">Teléfono</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Teléfono / WhatsApp</Label>
              <Input value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} placeholder="+57 300 123 4567" />
            </div>
            <div className="space-y-2">
              <Label>Cierre esperado</Label>
              <Input type="date" value={expectedClose} onChange={(e) => setExpectedClose(e.target.value)} />
            </div>
          </div>

          {stages.length > 0 && (
            <div className="space-y-2">
              <Label>Etapa</Label>
              <Select value={stageId} onValueChange={setStageId}>
                <SelectTrigger><SelectValue placeholder="Automática (primera)" /></SelectTrigger>
                <SelectContent>
                  {stages.map(s => (
                    <SelectItem key={s.id} value={s.id}>
                      <span className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color }} />
                        {s.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label>Notas</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Notas adicionales..." />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={isLoading || !title.trim()}>
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {defaultValues ? 'Guardar' : 'Crear'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
