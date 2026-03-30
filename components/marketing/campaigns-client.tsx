'use client'

import { useState, useMemo, useRef, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Plus, Send, Edit, Trash2, Eye, Users, Loader2,
  BarChart3, Mail, Clock, Search, Megaphone, ArrowRight, Sparkles, Wand2
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { formatDate, formatDateTime } from '@/lib/utils'
import { PageHeader } from '@/components/ui/page-header'
import CampaignForm from '@/components/marketing/campaign-form'
import CampaignDetails from '@/components/marketing/campaign-details'
import { cn } from '@/lib/utils'
import { useToast } from '@/components/ui/toast'

const statusTabs = [
  { value: '', label: 'Todas', icon: BarChart3 },
  { value: 'DRAFT', label: 'Borradores', icon: Edit },
  { value: 'SCHEDULED', label: 'Programadas', icon: Clock },
  { value: 'SENT', label: 'Enviadas', icon: Send },
]

export default function CampaignsClient() {
  const [showForm, setShowForm] = useState(false)
  const [selectedCampaign, setSelectedCampaign] = useState<string | null>(null)
  const [editingCampaignId, setEditingCampaignId] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [searchQuery, setSearchQuery] = useState('')
  const [aiPrompt, setAiPrompt] = useState('')
  const [isAiCreating, setIsAiCreating] = useState(false)
  const [aiCampaignData, setAiCampaignData] = useState<{ name: string; subject: string; htmlContent: string } | null>(null)

  const queryClient = useQueryClient()
  const { toast } = useToast()

  // Listen for Clivi AI campaign creation events
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail
      if (detail?.name && detail?.subject && detail?.htmlContent) {
        setAiCampaignData(detail)
        setShowForm(true)
        toast('🐙 Clivi generó tu campaña — ¡revísala!', 'success')
      }
    }
    window.addEventListener('clivi:create-campaign', handler)
    return () => window.removeEventListener('clivi:create-campaign', handler)
  }, [toast])

  const { data: campaigns, isLoading } = useQuery({
    queryKey: ['marketing-campaigns', statusFilter],
    queryFn: async () => {
      const url = statusFilter
        ? `/api/marketing/campaigns?status=${statusFilter}`
        : '/api/marketing/campaigns'
      const res = await fetch(url)
      if (!res.ok) throw new Error('Failed to fetch campaigns')
      return res.json()
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/marketing/campaigns/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete campaign')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['marketing-campaigns'] })
      toast('Campaña eliminada', 'success')
    },
    onError: () => toast('Error al eliminar la campaña', 'error'),
  })

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      DRAFT: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
      SCHEDULED: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
      SENDING: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
      SENT: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
      CANCELLED: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    }
    return colors[status] || 'bg-slate-100 text-slate-700'
  }

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      DRAFT: 'Borrador', SCHEDULED: 'Programada', SENDING: 'Enviando',
      SENT: 'Enviada', CANCELLED: 'Cancelada',
    }
    return labels[status] || status
  }

  const campaignsList = useMemo(() => {
    const list = Array.isArray(campaigns) ? campaigns : []
    if (!searchQuery.trim()) return list
    const q = searchQuery.toLowerCase()
    return list.filter((c: any) =>
      c.name?.toLowerCase().includes(q) || c.subject?.toLowerCase().includes(q)
    )
  }, [campaigns, searchQuery])

  // ─── KPI Stats ───
  const stats = useMemo(() => {
    const all = Array.isArray(campaigns) ? campaigns : []
    const totalRecipients = all.reduce((sum: number, c: any) => sum + (c.recipients?.length || 0), 0)
    const totalSent = all.reduce((sum: number, c: any) =>
      sum + (c.recipients?.filter((r: any) => r.status === 'SENT').length || 0), 0)
    return {
      total: all.length,
      drafts: all.filter((c: any) => c.status === 'DRAFT').length,
      sent: all.filter((c: any) => c.status === 'SENT').length,
      totalRecipients,
      totalSent,
    }
  }, [campaigns])

  // AI: create campaign from prompt
  const handleAiCreate = async () => {
    if (!aiPrompt.trim()) return
    setIsAiCreating(true)
    try {
      const res = await fetch('/api/ai/marketing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create-campaign', prompt: aiPrompt }),
      })
      if (!res.ok) throw new Error((await res.json()).error || 'Error de IA')
      const data = await res.json()
      setAiCampaignData(data)
      setShowForm(true)
      setAiPrompt('')
      toast('¡Campaña generada con IA! 🎉', 'success')
    } catch (err: any) {
      toast(err.message || 'Error al generar campaña', 'error')
    } finally {
      setIsAiCreating(false)
    }
  }

  if (selectedCampaign) {
    return (
      <CampaignDetails
        campaignId={selectedCampaign}
        onBack={() => setSelectedCampaign(null)}
        onEdit={(id) => {
          setSelectedCampaign(null)
          setEditingCampaignId(id)
          setShowForm(true)
        }}
      />
    )
  }

  if (showForm) {
    return (
      <CampaignForm
        campaignId={editingCampaignId || undefined}
        aiDefaults={aiCampaignData || undefined}
        onClose={() => {
          setShowForm(false)
          setEditingCampaignId(null)
          setAiCampaignData(null)
        }}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['marketing-campaigns'] })
        }}
      />
    )
  }

  return (
    <div className="space-y-5">
      {/* AI Command Bar */}
      <div className="relative">
        <div className="flex gap-2 p-1 rounded-2xl border-2 border-purple-200 dark:border-purple-800 bg-gradient-to-r from-purple-50/50 to-indigo-50/50 dark:from-purple-900/10 dark:to-indigo-900/10 shadow-sm">
          <div className="flex items-center gap-2 pl-3 shrink-0">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center">
              <Wand2 className="w-3.5 h-3.5 text-white" />
            </div>
          </div>
          <input
            value={aiPrompt}
            onChange={(e) => setAiPrompt(e.target.value)}
            placeholder='Escribe qué campaña quieres... Ej: "Ofertas de pinturas con 30% descuento"'
            className="flex-1 bg-transparent border-0 py-2.5 text-sm text-slate-800 dark:text-white placeholder:text-purple-400/60 focus:outline-none"
            onKeyDown={(e) => { if (e.key === 'Enter') handleAiCreate() }}
          />
          <Button
            onClick={handleAiCreate}
            disabled={isAiCreating || !aiPrompt.trim()}
            className="rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white px-5 text-xs font-bold shadow-md"
          >
            {isAiCreating ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Generando...</> : <><Sparkles className="w-3.5 h-3.5 mr-1.5" /> Crear con IA</>}
          </Button>
        </div>
        <p className="text-[10px] text-purple-400 mt-1.5 pl-2">Powered by Gemini 2.0 Flash · Crea campañas completas con un solo prompt</p>
      </div>

      {/* Header + New Button */}
      <div className="flex items-center justify-between">
        <div />
        <Button onClick={() => setShowForm(true)} className="bg-blue-600 hover:bg-blue-700 rounded-lg">
          <Plus className="h-4 w-4 mr-2" />
          Nueva Campaña
        </Button>
      </div>

      {/* KPI Stats Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total Campañas', value: stats.total, icon: Megaphone, color: 'text-blue-600 bg-blue-50 dark:bg-blue-900/20' },
          { label: 'Borradores', value: stats.drafts, icon: Edit, color: 'text-slate-600 bg-slate-50 dark:bg-slate-800' },
          { label: 'Enviadas', value: stats.sent, icon: Send, color: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20' },
          { label: 'Emails Enviados', value: stats.totalSent, icon: Mail, color: 'text-purple-600 bg-purple-50 dark:bg-purple-900/20' },
        ].map((s, i) => (
          <Card key={i} className="border-slate-100 dark:border-slate-800">
            <CardContent className="p-4 flex items-center gap-3">
              <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0", s.color)}>
                <s.icon className="w-5 h-5" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900 dark:text-white">{s.value}</p>
                <p className="text-xs text-slate-500 font-medium">{s.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters: Tabs + Search */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
          {statusTabs.map((tab) => {
            const Icon = tab.icon
            return (
              <button
                key={tab.value}
                onClick={() => setStatusFilter(tab.value)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all",
                  statusFilter === tab.value
                    ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm"
                    : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                )}
              >
                <Icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            )
          })}
        </div>
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Buscar campaña..."
            className="pl-9 h-9"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Content */}
      {isLoading && campaignsList.length === 0 ? (
        <div className="grid gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6">
                <div className="flex gap-4">
                  <div className="w-10 h-10 bg-slate-200 dark:bg-slate-700 rounded-xl shrink-0" />
                  <div className="flex-1 space-y-3">
                    <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-1/3" />
                    <div className="h-3 bg-slate-100 dark:bg-slate-800 rounded w-2/3" />
                    <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded w-full" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : campaignsList.length === 0 ? (
        /* ─── Onboarding Empty State ─── */
        <Card className="border-dashed border-2 border-slate-200 dark:border-slate-700">
          <CardContent className="py-16 text-center">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-100 to-indigo-100 dark:from-blue-900/30 dark:to-indigo-900/30 flex items-center justify-center mx-auto mb-6">
              <Sparkles className="w-10 h-10 text-blue-600 dark:text-blue-400" />
            </div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
              {searchQuery ? 'Sin resultados' : '¡Crea tu primera campaña!'}
            </h3>
            <p className="text-slate-500 max-w-md mx-auto mb-8">
              {searchQuery
                ? `No encontramos campañas con "${searchQuery}".`
                : 'Diseña emails profesionales y envíalos a tus clientes en 3 simples pasos.'
              }
            </p>

            {!searchQuery && (
              <>
                <div className="flex flex-col sm:flex-row justify-center gap-6 mb-8 max-w-lg mx-auto">
                  {[
                    { step: '1', title: 'Diseña', desc: 'Usa plantillas o el editor visual' },
                    { step: '2', title: 'Agrega', desc: 'Selecciona destinatarios' },
                    { step: '3', title: 'Envía', desc: 'Programa o envía al instante' },
                  ].map((s, i) => (
                    <div key={i} className="flex flex-col items-center text-center">
                      <div className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-bold mb-2">
                        {s.step}
                      </div>
                      <p className="text-sm font-semibold text-slate-900 dark:text-white">{s.title}</p>
                      <p className="text-xs text-slate-500">{s.desc}</p>
                    </div>
                  ))}
                </div>
                <Button onClick={() => setShowForm(true)} size="lg" className="bg-blue-600 hover:bg-blue-700">
                  <Plus className="h-4 w-4 mr-2" />
                  Crear Primera Campaña
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {campaignsList.map((campaign: any) => {
            const sentCount = campaign.recipients?.filter((r: any) => r.status === 'SENT').length || 0
            const totalRecipients = campaign.recipients?.length || 0
            const progress = totalRecipients > 0 ? (sentCount / totalRecipients) * 100 : 0

            return (
              <Card key={campaign.id} className="group hover:shadow-md hover:border-blue-200 dark:hover:border-blue-800 transition-all duration-200">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    {/* Left: Info */}
                    <div className="flex gap-4 flex-1 min-w-0">
                      <div className={cn(
                        "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
                        campaign.status === 'SENT' ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600' :
                        campaign.status === 'DRAFT' ? 'bg-slate-100 dark:bg-slate-800 text-slate-500' :
                        'bg-blue-100 dark:bg-blue-900/30 text-blue-600'
                      )}>
                        <Mail className="w-5 h-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold text-slate-900 dark:text-white truncate">{campaign.name}</h3>
                          <Badge className={cn("text-[10px] font-semibold shrink-0", getStatusColor(campaign.status))}>
                            {getStatusLabel(campaign.status)}
                          </Badge>
                        </div>
                        <p className="text-sm text-slate-500 truncate">{campaign.subject}</p>

                        {/* Meta row */}
                        <div className="flex items-center gap-4 mt-3 text-xs text-slate-400">
                          <span>Creada: {formatDate(campaign.createdAt)}</span>
                          <span className="flex items-center gap-1">
                            <Users className="w-3 h-3" />
                            {sentCount}/{totalRecipients}
                          </span>
                          {campaign.sentAt && <span>Enviada: {formatDateTime(campaign.sentAt)}</span>}
                        </div>

                        {/* Progress bar */}
                        {totalRecipients > 0 && (
                          <div className="mt-2">
                            <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                              <div
                                className={cn(
                                  "h-full rounded-full transition-all",
                                  progress === 100 ? 'bg-emerald-500' : progress > 0 ? 'bg-blue-500' : 'bg-slate-300'
                                )}
                                style={{ width: `${progress}%` }}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Right: Actions */}
                    <div className="flex gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button variant="ghost" size="sm" onClick={() => setSelectedCampaign(campaign.id)} title="Ver detalles">
                        <Eye className="h-4 w-4" />
                      </Button>
                      {campaign.status === 'DRAFT' && (
                        <>
                          <Button variant="ghost" size="sm" onClick={() => {
                            setEditingCampaignId(campaign.id)
                            setShowForm(true)
                          }} title="Editar">
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => {
                            if (confirm('¿Eliminar esta campaña?')) deleteMutation.mutate(campaign.id)
                          }} title="Eliminar">
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
