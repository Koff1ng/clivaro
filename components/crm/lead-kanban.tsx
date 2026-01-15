'use client'

import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { dateInputToIso, formatCurrency, toDateInputValue } from '@/lib/utils'
import { Eye, Edit, User } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/components/ui/toast'
import {
  DndContext,
  DragOverlay,
  rectIntersection,
  useDraggable,
  useDroppable,
  type DragCancelEvent,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'

type KanbanQueryKey = readonly unknown[]

function LeadCard({
  lead,
  dragging,
  overlay,
  onView,
  onEdit,
  dragHandleProps,
  dragRef,
  dragStyle,
}: {
  lead: any
  dragging?: boolean
  overlay?: boolean
  onView: () => void
  onEdit: () => void
  dragHandleProps?: any
  dragRef?: (node: HTMLElement | null) => void
  dragStyle?: React.CSSProperties
}) {
  return (
    <div
      ref={dragRef as any}
      style={dragStyle}
      className={[
        'bg-white rounded-lg p-3 border select-none',
        overlay ? 'shadow-xl border-primary/30' : 'shadow-sm hover:shadow-md transition-shadow',
        dragging ? 'opacity-40' : '',
      ].join(' ')}
    >
      <div className="flex justify-between items-start mb-2">
        <div className="flex items-start gap-2 min-w-0">
          {/* Drag handle (only this starts drag) */}
          <button
            type="button"
            aria-label="Arrastrar"
            className="mt-0.5 h-6 w-6 rounded border bg-muted/30 text-muted-foreground hover:bg-muted/50 cursor-grab active:cursor-grabbing flex items-center justify-center"
            {...(dragHandleProps || {})}
            onClick={(e) => e.preventDefault()}
          >
            ⋮⋮
          </button>
          <h4 className="font-medium text-sm truncate">{lead.name}</h4>
        </div>
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation()
              onView()
            }}
          >
            <Eye className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation()
              onEdit()
            }}
          >
            <Edit className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {lead.company && <p className="text-xs text-gray-600 mb-1">{lead.company}</p>}

      <div className="flex items-center justify-between mt-2">
        <div className="flex items-center gap-2 text-xs text-gray-600">
          <User className="h-3 w-3" />
          <span className="truncate max-w-[140px]">{lead.assignedTo?.name || 'Sin asignar'}</span>
        </div>
        <span className="text-[11px] font-semibold text-gray-700">{formatCurrency(lead.expectedRevenue || 0)}</span>
      </div>

      <div className="flex justify-between items-center mt-2">
        <span className="text-xs font-semibold text-blue-600">
          {formatCurrency((lead.expectedRevenue || 0) * ((lead.probability || 0) / 100))}
        </span>
        <div className="flex items-center gap-2">
          <div className="w-16 bg-gray-200 rounded-full h-1.5">
            <div className="bg-blue-600 h-1.5 rounded-full" style={{ width: `${lead.probability || 0}%` }} />
          </div>
          <span className="text-xs text-gray-600">{lead.probability || 0}%</span>
        </div>
      </div>

      {lead.expectedCloseDate && (
        <p className="text-xs text-gray-500 mt-1">
          Cierre: {new Date(lead.expectedCloseDate).toLocaleDateString('es-ES')}
        </p>
      )}
    </div>
  )
}

function DraggableLead({
  lead,
  onView,
  onEdit,
}: {
  lead: any
  onView: () => void
  onEdit: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: lead.id,
    data: { lead },
  })

  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    transition: 'transform 180ms ease',
  }

  return (
    <LeadCard
      lead={lead}
      dragging={isDragging}
      onView={onView}
      onEdit={onEdit}
      dragHandleProps={{ ...attributes, ...listeners }}
      dragRef={setNodeRef as any}
      dragStyle={style}
    />
  )
}

function DroppableStage({
  id,
  className,
  children,
}: {
  id: string
  className: string
  children: React.ReactNode
}) {
  const { setNodeRef, isOver } = useDroppable({ id })
  return (
    <div ref={setNodeRef} className={[className, isOver ? 'ring-2 ring-primary/60' : ''].join(' ')}>
      {children}
    </div>
  )
}

export function LeadKanban({
  leads,
  users = [],
  queryKey,
  onLeadClick,
}: {
  leads: any[]
  users?: any[]
  queryKey?: KanbanQueryKey
  onLeadClick: (lead: any) => void
}) {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [localLeads, setLocalLeads] = useState<any[]>(leads || [])
  const [dragOverStage, setDragOverStage] = useState<string | null>(null)
  const [editingLead, setEditingLead] = useState<any | null>(null)
  const [kanbanSearch, setKanbanSearch] = useState('')
  const [kanbanAssignedTo, setKanbanAssignedTo] = useState<string>('')
  const [activeLeadId, setActiveLeadId] = useState<string | null>(null)
  const [dragSnapshot, setDragSnapshot] = useState<any[] | null>(null)

  useEffect(() => {
    setLocalLeads(leads || [])
  }, [leads])

  const effectiveQueryKey = useMemo(() => queryKey || (['leads'] as const), [queryKey])

  const updateLeadMutation = useMutation({
    mutationFn: async ({
      leadId,
      patch,
    }: {
      leadId: string
      patch: {
        stage?: string
        probability?: number
        expectedRevenue?: number
        expectedCloseDate?: string | null
        assignedToId?: string | null
      }
    }) => {
      const res = await fetch(`/api/leads/${leadId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || 'No se pudo actualizar la oportunidad')
      return data
    },
    onMutate: async ({ leadId, patch }) => {
      await queryClient.cancelQueries({ queryKey: effectiveQueryKey as any })
      const prev = queryClient.getQueryData(effectiveQueryKey as any)

      // Optimistic: local view
      setLocalLeads((curr) =>
        curr.map((l) =>
          l.id === leadId
            ? {
                ...l,
                ...patch,
                expectedCloseDate: patch.expectedCloseDate !== undefined ? patch.expectedCloseDate : l.expectedCloseDate,
              }
            : l
        )
      )

      // Optimistic: cached list (if matches {leads:[]})
      queryClient.setQueryData(effectiveQueryKey as any, (old: any) => {
        if (!old) return old
        if (Array.isArray(old.leads)) {
          return {
            ...old,
            leads: old.leads.map((l: any) =>
              l.id === leadId
                ? {
                    ...l,
                    ...patch,
                    expectedCloseDate: patch.expectedCloseDate !== undefined ? patch.expectedCloseDate : l.expectedCloseDate,
                  }
                : l
            ),
          }
        }
        return old
      })

      return { prev }
    },
    onError: (error: any, _vars, ctx: any) => {
      if (ctx?.prev) queryClient.setQueryData(effectiveQueryKey as any, ctx.prev)
      setLocalLeads(leads || [])
      toast(error?.message || 'Error al actualizar', 'error')
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: effectiveQueryKey as any })
    },
  })

  const stages = [
    { id: 'NEW', label: 'Nueva', color: 'bg-blue-100 border-blue-300' },
    { id: 'CONTACTED', label: 'Contactado', color: 'bg-yellow-100 border-yellow-300' },
    { id: 'QUOTED', label: 'Cotizado', color: 'bg-purple-100 border-purple-300' },
    { id: 'WON', label: 'Ganada', color: 'bg-green-100 border-green-300' },
    { id: 'LOST', label: 'Perdida', color: 'bg-red-100 border-red-300' },
  ]

  const filteredLeads = useMemo(() => {
    const s = kanbanSearch.trim().toLowerCase()
    return localLeads.filter((l) => {
      if (kanbanAssignedTo && (l.assignedToId || '') !== kanbanAssignedTo) return false
      if (!s) return true
      const hay = `${l.name || ''} ${l.company || ''} ${l.email || ''} ${l.phone || ''}`.toLowerCase()
      return hay.includes(s)
    })
  }, [localLeads, kanbanSearch, kanbanAssignedTo])

  const activeLead = useMemo(() => {
    if (!activeLeadId) return null
    return localLeads.find((l) => l.id === activeLeadId) || null
  }, [activeLeadId, localLeads])

  const handleDndStart = (event: DragStartEvent) => {
    const leadId = String(event.active.id)
    setActiveLeadId(leadId)
    setDragSnapshot(localLeads)
  }

  const handleDndOver = (event: DragOverEvent) => {
    const overId = event.over?.id ? String(event.over.id) : null
    setDragOverStage(overId)

    // Preview move while dragging between columns
    if (!overId) return
    const leadId = String(event.active.id)
    setLocalLeads((curr) => curr.map((l) => (l.id === leadId ? { ...l, stage: overId } : l)))
  }

  const revertIfNeeded = () => {
    if (dragSnapshot) setLocalLeads(dragSnapshot)
    setDragSnapshot(null)
    setDragOverStage(null)
    setActiveLeadId(null)
  }

  const handleDndCancel = (_event: DragCancelEvent) => {
    revertIfNeeded()
  }

  const handleDndEnd = (event: DragEndEvent) => {
    const leadId = String(event.active.id)
    const overId = event.over?.id ? String(event.over.id) : null

    if (!overId) {
      // Dropped outside any stage → rollback
      revertIfNeeded()
      return
    }

    // Commit only if changed
    const before = dragSnapshot?.find((l) => l.id === leadId)?.stage
    const after = overId
    setDragSnapshot(null)
    setDragOverStage(null)
    setActiveLeadId(null)

    if (before && before !== after) {
      updateLeadMutation.mutate({ leadId, patch: { stage: after } })
    } else {
      // no change, ensure we revert preview to actual
      if (dragSnapshot) setLocalLeads(dragSnapshot)
    }
  }

  return (
    <>
      <div className="flex items-center gap-2 pb-3">
        <Input
          value={kanbanSearch}
          onChange={(e) => setKanbanSearch(e.target.value)}
          placeholder="Filtrar en Kanban…"
          className="max-w-sm"
        />
        <select
          value={kanbanAssignedTo}
          onChange={(e) => setKanbanAssignedTo(e.target.value)}
          className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          <option value="">Todos</option>
          {users.map((u: any) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </select>
        <div className="text-xs text-muted-foreground">
          Mostrando {filteredLeads.length} / {localLeads.length}
        </div>
      </div>

      <DndContext
        collisionDetection={rectIntersection}
        onDragStart={handleDndStart}
        onDragOver={handleDndOver}
        onDragCancel={handleDndCancel}
        onDragEnd={handleDndEnd}
      >
        <div className="flex gap-4 overflow-x-auto pb-4">
          {stages.map((stage) => {
            const stageLeads = filteredLeads.filter((l) => l.stage === stage.id)
            const stageValue = stageLeads.reduce((sum, l) => sum + (l.expectedRevenue || 0), 0)
            const weightedValue = stageLeads.reduce((sum, l) => {
              const prob = (l.probability || 0) / 100
              return sum + ((l.expectedRevenue || 0) * prob)
            }, 0)

            return (
              <DroppableStage
                key={stage.id}
                id={stage.id}
                className={`flex-shrink-0 w-80 border-2 rounded-lg p-4 ${stage.color} ${
                  dragOverStage === stage.id ? 'ring-2 ring-primary/60' : ''
                }`}
              >
                <div className="mb-4">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-semibold text-lg">{stage.label}</h3>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded bg-white/70 border">
                      {stageLeads.length}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500">
                    Valor: {formatCurrency(stageValue)} · Ponderado: {formatCurrency(weightedValue)}
                  </p>
                </div>

                <div className="space-y-2 max-h-[600px] overflow-y-auto">
                  {stageLeads.length === 0 && (
                    <div className="bg-white/60 border rounded-lg p-3 text-xs text-muted-foreground">
                      Arrastra oportunidades aquí.
                    </div>
                  )}
                  {stageLeads.map((lead) => (
                    <DraggableLead
                      key={lead.id}
                      lead={lead}
                      onView={() => onLeadClick(lead)}
                      onEdit={() => setEditingLead(lead)}
                    />
                  ))}
                </div>
              </DroppableStage>
            )
          })}
        </div>

        <DragOverlay dropAnimation={{ duration: 220, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' }}>
          {activeLead ? (
            <div className="rotate-[1deg] scale-[1.02]">
              <LeadCard
                lead={activeLead}
                overlay
                onView={() => onLeadClick(activeLead)}
                onEdit={() => setEditingLead(activeLead)}
              />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* Quick edit modal */}
      <Dialog open={!!editingLead} onOpenChange={(open) => !open && setEditingLead(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Editar oportunidad</DialogTitle>
          </DialogHeader>
          {editingLead && (
            <div className="space-y-4">
              <div>
                <Label>Probabilidad (%)</Label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={editingLead.probability ?? 0}
                  onChange={(e) => setEditingLead({ ...editingLead, probability: Number(e.target.value) })}
                />
              </div>
              <div>
                <Label>Ingreso esperado</Label>
                <Input
                  type="number"
                  min={0}
                  value={editingLead.expectedRevenue ?? 0}
                  onChange={(e) => setEditingLead({ ...editingLead, expectedRevenue: Number(e.target.value) })}
                />
              </div>
              <div>
                <Label>Fecha cierre esperada</Label>
                <Input
                  type="date"
                  value={editingLead.expectedCloseDate ? toDateInputValue(editingLead.expectedCloseDate) : ''}
                  onChange={(e) =>
                    setEditingLead({
                      ...editingLead,
                      expectedCloseDate: e.target.value ? dateInputToIso(e.target.value) : null,
                    })
                  }
                />
              </div>
              <div>
                <Label>Asignado a</Label>
                <select
                  value={editingLead.assignedToId || ''}
                  onChange={(e) => setEditingLead({ ...editingLead, assignedToId: e.target.value || null })}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="">Sin asignar</option>
                  {users.map((u: any) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setEditingLead(null)}>
                  Cancelar
                </Button>
                <Button
                  type="button"
                  onClick={() => {
                    const leadId = editingLead.id
                    updateLeadMutation.mutate({
                      leadId,
                      patch: {
                        probability: Number(editingLead.probability || 0),
                        expectedRevenue: Number(editingLead.expectedRevenue || 0),
                        expectedCloseDate: editingLead.expectedCloseDate || null,
                        assignedToId: editingLead.assignedToId || null,
                      },
                    })
                    setEditingLead(null)
                    toast('Cambios guardados', 'success')
                  }}
                  disabled={updateLeadMutation.isPending}
                >
                  {updateLeadMutation.isPending ? 'Guardando…' : 'Guardar'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}

