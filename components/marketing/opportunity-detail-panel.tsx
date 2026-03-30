'use client'

import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  X, Phone, Mail, Calendar, DollarSign, User, MessageCircle,
  Clock, FileText, PhoneCall, Video, ArrowRight, Send, Loader2,
  Target, TrendingUp, Percent, Tag, Building2, Notebook
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'

interface Stage {
  id: string
  name: string
  color: string
  isWon: boolean
  isLost: boolean
}

interface Activity {
  id: string
  type: string
  content?: string
  metadata?: string
  createdById?: string
  createdAt: string
}

interface OpportunityDetail {
  id: string
  title: string
  description?: string
  value: number
  probability: number
  priority: string
  source?: string
  contactPhone?: string
  notes?: string
  stageId?: string
  expectedCloseDate?: string
  closedDate?: string
  pipelineStage?: Stage
  customer?: { id: string; name: string; phone?: string; email?: string; taxId?: string }
  activities: Activity[]
  createdAt: string
  updatedAt: string
}

const PRIORITY_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  LOW: { label: 'Baja', color: 'text-slate-600', bg: 'bg-slate-100 dark:bg-slate-800' },
  MEDIUM: { label: 'Media', color: 'text-blue-600', bg: 'bg-blue-100 dark:bg-blue-900' },
  HIGH: { label: 'Alta', color: 'text-orange-600', bg: 'bg-orange-100 dark:bg-orange-900' },
  URGENT: { label: 'Urgente', color: 'text-red-600', bg: 'bg-red-100 dark:bg-red-900' },
}

const ACTIVITY_ICONS: Record<string, any> = {
  NOTE: FileText,
  CALL: PhoneCall,
  EMAIL: Mail,
  WHATSAPP: MessageCircle,
  MEETING: Video,
  STAGE_CHANGE: ArrowRight,
}

const ACTIVITY_LABELS: Record<string, string> = {
  NOTE: 'Nota',
  CALL: 'Llamada',
  EMAIL: 'Email',
  WHATSAPP: 'WhatsApp',
  MEETING: 'Reunión',
  STAGE_CHANGE: 'Cambio de etapa',
}

const SOURCE_LABELS: Record<string, string> = {
  WEB: 'Web', WHATSAPP: 'WhatsApp', REFERRAL: 'Referido',
  WALK_IN: 'Presencial', PHONE: 'Teléfono',
}

function formatCurrency(n: number) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n)
}

function formatRelativeTime(d: string) {
  const diff = Date.now() - new Date(d).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'ahora'
  if (mins < 60) return `hace ${mins}m`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `hace ${hrs}h`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `hace ${days}d`
  return new Date(d).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' })
}

export default function OpportunityDetailPanel({
  opportunityId,
  stages,
  onClose,
}: {
  opportunityId: string
  stages: Stage[]
  onClose: () => void
}) {
  const [activeTab, setActiveTab] = useState('detail')
  const [newActivityType, setNewActivityType] = useState('NOTE')
  const [newActivityContent, setNewActivityContent] = useState('')
  const queryClient = useQueryClient()

  // Fetch opportunity detail
  const { data: opp, isLoading } = useQuery<OpportunityDetail>({
    queryKey: ['opportunity-detail', opportunityId],
    queryFn: async () => {
      const res = await fetch(`/api/marketing/opportunities/${opportunityId}`)
      if (!res.ok) throw new Error('Failed')
      return res.json()
    },
  })

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch(`/api/marketing/opportunities/${opportunityId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error('Error')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['opportunity-detail', opportunityId] })
      queryClient.invalidateQueries({ queryKey: ['opportunities'] })
      queryClient.invalidateQueries({ queryKey: ['pipeline-stages'] })
    },
  })

  // Add activity mutation
  const addActivityMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch(`/api/marketing/opportunities/${opportunityId}/activities`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error('Error')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['opportunity-detail', opportunityId] })
      setNewActivityContent('')
    },
  })

  const handleAddActivity = () => {
    if (!newActivityContent.trim()) return
    addActivityMutation.mutate({
      type: newActivityType,
      content: newActivityContent.trim(),
    })
  }

  if (isLoading || !opp) {
    return (
      <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
        <div className="relative w-full max-w-lg bg-background shadow-2xl border-l flex items-center justify-center" onClick={e => e.stopPropagation()}>
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    )
  }

  const priorityConfig = PRIORITY_CONFIG[opp.priority] || PRIORITY_CONFIG.MEDIUM

  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity" />
      <div
        className="relative w-full max-w-lg bg-background shadow-2xl border-l flex flex-col animate-in slide-in-from-right duration-300"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-bold truncate">{opp.title}</h2>
            <div className="flex items-center gap-2 mt-1">
              {opp.pipelineStage && (
                <Badge
                  className="text-xs"
                  style={{ backgroundColor: opp.pipelineStage.color + '20', color: opp.pipelineStage.color, borderColor: opp.pipelineStage.color }}
                >
                  {opp.pipelineStage.name}
                </Badge>
              )}
              <Badge className={cn('text-xs', priorityConfig.bg, priorityConfig.color)}>
                {priorityConfig.label}
              </Badge>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="shrink-0">
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-3 gap-px bg-muted/50 border-b">
          <div className="bg-background px-4 py-3 text-center">
            <p className="text-xs text-muted-foreground">Valor</p>
            <p className="text-sm font-bold text-green-600">{formatCurrency(opp.value)}</p>
          </div>
          <div className="bg-background px-4 py-3 text-center">
            <p className="text-xs text-muted-foreground">Probabilidad</p>
            <p className="text-sm font-bold">{opp.probability}%</p>
          </div>
          <div className="bg-background px-4 py-3 text-center">
            <p className="text-xs text-muted-foreground">Ponderado</p>
            <p className="text-sm font-bold text-blue-600">{formatCurrency(opp.value * opp.probability / 100)}</p>
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="w-full justify-start rounded-none border-b px-4 h-10 bg-transparent">
            <TabsTrigger value="detail" className="text-xs data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-indigo-500 rounded-none">
              Detalle
            </TabsTrigger>
            <TabsTrigger value="activities" className="text-xs data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-indigo-500 rounded-none">
              Actividades ({opp.activities?.length || 0})
            </TabsTrigger>
          </TabsList>

          {/* Detail Tab */}
          <TabsContent value="detail" className="flex-1 overflow-y-auto m-0 p-4 space-y-4">
            {/* Customer */}
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                <User className="h-3.5 w-3.5" /> Cliente
              </Label>
              {opp.customer ? (
                <div className="p-3 bg-muted/30 rounded-lg border">
                  <p className="font-medium text-sm">{opp.customer.name}</p>
                  <div className="flex gap-3 mt-1 text-xs text-muted-foreground">
                    {opp.customer.phone && (
                      <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{opp.customer.phone}</span>
                    )}
                    {opp.customer.email && (
                      <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{opp.customer.email}</span>
                    )}
                  </div>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground italic">Sin cliente vinculado</p>
              )}
            </div>

            {/* Stage Selector */}
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Target className="h-3.5 w-3.5" /> Etapa
              </Label>
              <Select
                value={opp.stageId || ''}
                onValueChange={(v) => updateMutation.mutate({ stageId: v })}
              >
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
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

            {/* Value + Probability */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <DollarSign className="h-3.5 w-3.5" /> Valor (COP)
                </Label>
                <Input
                  type="number"
                  defaultValue={opp.value}
                  className="h-9"
                  onBlur={(e) => {
                    const v = parseFloat(e.target.value)
                    if (!isNaN(v) && v !== opp.value) updateMutation.mutate({ value: v })
                  }}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <Percent className="h-3.5 w-3.5" /> Probabilidad
                </Label>
                <Input
                  type="number"
                  min={0} max={100}
                  defaultValue={opp.probability}
                  className="h-9"
                  onBlur={(e) => {
                    const v = parseInt(e.target.value)
                    if (!isNaN(v) && v !== opp.probability) updateMutation.mutate({ probability: v })
                  }}
                />
              </div>
            </div>

            {/* Priority + Source */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <Tag className="h-3.5 w-3.5" /> Prioridad
                </Label>
                <Select
                  value={opp.priority}
                  onValueChange={(v) => updateMutation.mutate({ priority: v })}
                >
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="LOW">Baja</SelectItem>
                    <SelectItem value="MEDIUM">Media</SelectItem>
                    <SelectItem value="HIGH">Alta</SelectItem>
                    <SelectItem value="URGENT">Urgente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <Building2 className="h-3.5 w-3.5" /> Fuente
                </Label>
                <Select
                  value={opp.source || ''}
                  onValueChange={(v) => updateMutation.mutate({ source: v })}
                >
                  <SelectTrigger className="h-9"><SelectValue placeholder="—" /></SelectTrigger>
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

            {/* Phone + Close Date */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <Phone className="h-3.5 w-3.5" /> Teléfono
                </Label>
                <Input
                  defaultValue={opp.contactPhone || ''}
                  placeholder="+57..."
                  className="h-9"
                  onBlur={(e) => {
                    if (e.target.value !== (opp.contactPhone || ''))
                      updateMutation.mutate({ contactPhone: e.target.value || null })
                  }}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5" /> Cierre esperado
                </Label>
                <Input
                  type="date"
                  defaultValue={opp.expectedCloseDate ? String(opp.expectedCloseDate).split('T')[0] : ''}
                  className="h-9"
                  onChange={(e) => updateMutation.mutate({ expectedCloseDate: e.target.value || null })}
                />
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Notebook className="h-3.5 w-3.5" /> Notas
              </Label>
              <Textarea
                defaultValue={opp.notes || ''}
                rows={3}
                placeholder="Notas sobre la oportunidad..."
                className="text-sm"
                onBlur={(e) => {
                  if (e.target.value !== (opp.notes || ''))
                    updateMutation.mutate({ notes: e.target.value || null })
                }}
              />
            </div>

            {/* Metadata */}
            <div className="pt-2 border-t text-[10px] text-muted-foreground space-y-0.5">
              <p>Creada: {formatDate(opp.createdAt)}</p>
              <p>Actualizada: {formatRelativeTime(opp.updatedAt)}</p>
              {opp.closedDate && <p>Cerrada: {formatDate(opp.closedDate)}</p>}
            </div>
          </TabsContent>

          {/* Activities Tab */}
          <TabsContent value="activities" className="flex-1 flex flex-col overflow-hidden m-0">
            {/* Add Activity Form */}
            <div className="p-4 border-b space-y-2">
              <div className="flex gap-2">
                <Select value={newActivityType} onValueChange={setNewActivityType}>
                  <SelectTrigger className="w-32 h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NOTE">📝 Nota</SelectItem>
                    <SelectItem value="CALL">📞 Llamada</SelectItem>
                    <SelectItem value="EMAIL">📧 Email</SelectItem>
                    <SelectItem value="MEETING">🤝 Reunión</SelectItem>
                    <SelectItem value="WHATSAPP">💬 WhatsApp</SelectItem>
                  </SelectContent>
                </Select>
                <div className="flex-1 relative">
                  <Input
                    value={newActivityContent}
                    onChange={(e) => setNewActivityContent(e.target.value)}
                    placeholder="Describe la actividad..."
                    className="h-9 pr-9"
                    onKeyDown={(e) => { if (e.key === 'Enter') handleAddActivity() }}
                  />
                  <Button
                    size="icon"
                    variant="ghost"
                    className="absolute right-0.5 top-0.5 h-8 w-8"
                    onClick={handleAddActivity}
                    disabled={addActivityMutation.isPending || !newActivityContent.trim()}
                  >
                    {addActivityMutation.isPending
                      ? <Loader2 className="h-4 w-4 animate-spin" />
                      : <Send className="h-4 w-4" />
                    }
                  </Button>
                </div>
              </div>
            </div>

            {/* Activity Timeline */}
            <div className="flex-1 overflow-y-auto p-4">
              {(!opp.activities || opp.activities.length === 0) ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No hay actividades registradas
                </p>
              ) : (
                <div className="relative">
                  {/* Timeline line */}
                  <div className="absolute left-4 top-2 bottom-2 w-px bg-border" />

                  <div className="space-y-4">
                    {opp.activities.map((activity) => {
                      const Icon = ACTIVITY_ICONS[activity.type] || FileText
                      const isStageChange = activity.type === 'STAGE_CHANGE'

                      return (
                        <div key={activity.id} className="relative flex gap-3 pl-1">
                          {/* Icon dot */}
                          <div className={cn(
                            'relative z-10 flex items-center justify-center w-7 h-7 rounded-full border-2 shrink-0',
                            isStageChange
                              ? 'bg-indigo-100 border-indigo-300 dark:bg-indigo-900 dark:border-indigo-700'
                              : 'bg-background border-border'
                          )}>
                            <Icon className={cn(
                              'h-3.5 w-3.5',
                              isStageChange ? 'text-indigo-600 dark:text-indigo-400' : 'text-muted-foreground'
                            )} />
                          </div>

                          {/* Content */}
                          <div className="flex-1 min-w-0 pb-1">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
                                {ACTIVITY_LABELS[activity.type] || activity.type}
                              </Badge>
                              <span className="text-[10px] text-muted-foreground">
                                {formatRelativeTime(activity.createdAt)}
                              </span>
                            </div>
                            {activity.content && (
                              <p className={cn(
                                'text-sm mt-1',
                                isStageChange ? 'font-medium text-indigo-700 dark:text-indigo-300' : ''
                              )}>
                                {activity.content}
                              </p>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
