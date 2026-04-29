'use client'

import { useEffect, useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Plus, Mail, Send, Megaphone, Sparkles, Wand2, Loader2,
  Eye, Edit, Trash2, Users, Search, ChevronRight, BarChart3,
  CheckCircle, Clock
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn, formatDate, formatDateTime } from '@/lib/utils'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import CampaignForm from '@/components/marketing/campaign-form'
import CampaignDetails from '@/components/marketing/campaign-details'
import { useToast } from '@/components/ui/toast'
import { useConfirm } from '@/components/ui/confirm-dialog'

export default function CampaignsClient() {
  const [showForm, setShowForm] = useState(false)
  const [selectedCampaign, setSelectedCampaign] = useState<string | null>(null)
  const [editingCampaignId, setEditingCampaignId] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [searchQuery, setSearchQuery] = useState('')
  const [aiPrompt, setAiPrompt] = useState('')
  const [isAiCreating, setIsAiCreating] = useState(false)
  const [aiCampaignData, setAiCampaignData] = useState<{ name: string; subject: string; htmlContent: string; _blocks?: any[] } | null>(null)

  const queryClient = useQueryClient()
  const { toast } = useToast()
  const { confirm, ConfirmDialog } = useConfirm()

  // Listen for Clivi AI campaign creation events
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail
      if (detail?.name && detail?.subject && (detail?.htmlContent || detail?._blocks)) {
        setAiCampaignData(detail)
        setShowForm(true)
        toast('🐙 Clivi generó tu campaña — ¡revísala!', 'success')
      }
    }
    window.addEventListener('clivi:create-campaign', handler)
    return () => window.removeEventListener('clivi:create-campaign', handler)
  }, [toast])

  const { data: campaigns = [], isLoading } = useQuery({
    queryKey: ['marketing-campaigns', statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (statusFilter) params.set('status', statusFilter)
      const res = await fetch(`/api/marketing/campaigns?${params}`)
      if (!res.ok) throw new Error('Error al obtener campañas')
      return res.json()
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/marketing/campaigns/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Error al eliminar')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['marketing-campaigns'] })
      toast('Campaña eliminada', 'success')
    },
    onError: () => toast('Error al eliminar', 'error'),
  })

  const handleAiCreate = async () => {
    if (!aiPrompt.trim()) return
    setIsAiCreating(true)
    try {
      const res = await fetch('/api/ai/marketing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create-campaign', params: { prompt: aiPrompt } }),
      })
      if (!res.ok) throw new Error('Error de IA')
      const data = await res.json()
      setAiCampaignData(data)
      setAiPrompt('')
      setShowForm(true)
      toast('🐙 ¡Campaña generada! Revísala y personalízala.', 'success')

      // Notify the user when not all image blocks could be auto-generated
      const meta = data._imageGeneration
      if (meta) {
        if (meta.skippedDueToLimit > 0) {
          toast(
            `Se generaron ${meta.generated} imágenes; ${meta.skippedDueToLimit} se quedaron sin generar por límite. Puedes crearlas desde el editor.`,
            'warning',
          )
        } else if (meta.failed > 0) {
          toast(
            `${meta.failed} imagen(es) no se pudieron generar. Puedes reintentarlas desde el editor.`,
            'warning',
          )
        }
      }
    } catch {
      toast('Error al generar con IA', 'error')
    } finally {
      setIsAiCreating(false)
    }
  }

  const campaignsList = useMemo(() => {
    if (!searchQuery) return campaigns
    const q = searchQuery.toLowerCase()
    return campaigns.filter((c: any) =>
      c.name?.toLowerCase().includes(q) || c.subject?.toLowerCase().includes(q)
    )
  }, [campaigns, searchQuery])

  const stats = useMemo(() => {
    const all = campaigns as any[]
    return {
      total: all.length,
      drafts: all.filter(c => c.status === 'DRAFT').length,
      sent: all.filter(c => c.status === 'SENT').length,
      totalSent: all.reduce((sum, c) => sum + (c.recipients?.filter((r: any) => r.status === 'SENT').length || 0), 0),
    }
  }, [campaigns])

  const statusTabs = [
    { value: '', label: 'Todas', icon: Megaphone },
    { value: 'DRAFT', label: 'Borradores', icon: Edit },
    { value: 'SENT', label: 'Enviadas', icon: Send },
  ]

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'DRAFT': return 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
      case 'SENT': return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
      case 'SENDING': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
      case 'SCHEDULED': return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
      default: return 'bg-slate-100 text-slate-500'
    }
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'DRAFT': return 'Borrador'
      case 'SENT': return 'Enviada'
      case 'SENDING': return 'Enviando'
      case 'SCHEDULED': return 'Programada'
      default: return status
    }
  }

  // Render form
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
        onSuccess={(createdId) => {
          if (!editingCampaignId && createdId) {
            // Keep the form open — it now has inline recipients
          } else {
            setShowForm(false)
            setEditingCampaignId(null)
            setAiCampaignData(null)
          }
          queryClient.invalidateQueries({ queryKey: ['marketing-campaigns'] })
        }}
      />
    )
  }

  // Render campaign details
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

  return (
    <div className="space-y-6">
      {/* ═══ AI Command Bar — Hero section ═══ */}
      <div className="rounded-2xl border border-purple-200/60 dark:border-purple-800/40 bg-gradient-to-br from-purple-50/80 via-indigo-50/60 to-blue-50/40 dark:from-purple-900/15 dark:via-indigo-900/10 dark:to-blue-900/5 p-5 shadow-sm">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-purple-200 dark:shadow-purple-900/30">
            <Wand2 className="w-4 h-4 text-white" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Crear con Clivi IA</h3>
            <p className="text-[11px] text-slate-500">Describe tu campaña y Clivi genera el email completo al instante</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Input
            value={aiPrompt}
            onChange={(e) => setAiPrompt(e.target.value)}
            placeholder='Ej: "Oferta de pinturas con 30% de descuento para clientes frecuentes"'
            className="flex-1 bg-white/80 dark:bg-slate-800/50 border-purple-200 dark:border-purple-700/50 text-sm placeholder:text-slate-400 h-10"
            onKeyDown={(e) => { if (e.key === 'Enter') handleAiCreate() }}
          />
          <Button
            onClick={handleAiCreate}
            disabled={isAiCreating || !aiPrompt.trim()}
            className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white px-5 text-xs font-bold shadow-md shadow-purple-200/50 dark:shadow-purple-900/30 h-10"
          >
            {isAiCreating ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Generando...</> : <><Sparkles className="w-3.5 h-3.5 mr-1.5" /> Crear con IA</>}
          </Button>
        </div>
      </div>

      {/* ═══ KPI Stats ═══ */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Campañas', value: stats.total, icon: Megaphone, color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-900/20' },
          { label: 'Borradores', value: stats.drafts, icon: Clock, color: 'text-slate-500', bg: 'bg-slate-50 dark:bg-slate-800' },
          { label: 'Enviadas', value: stats.sent, icon: CheckCircle, color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-900/20' },
          { label: 'Emails Totales', value: stats.totalSent, icon: BarChart3, color: 'text-purple-600', bg: 'bg-purple-50 dark:bg-purple-900/20' },
        ].map((s, i) => (
          <Card key={i} className="border-slate-100 dark:border-slate-800">
            <CardContent className="p-4 flex items-center gap-3">
              <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0", s.bg)}>
                <s.icon className={cn("w-5 h-5", s.color)} />
              </div>
              <div>
                <p className="text-xl font-bold text-slate-900 dark:text-white leading-none">{s.value}</p>
                <p className="text-[11px] text-slate-400 font-medium mt-0.5">{s.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ═══ Controls Bar: Tabs + Search + New ═══ */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
          {statusTabs.map((tab) => {
            const Icon = tab.icon
            return (
              <button
                key={tab.value}
                onClick={() => setStatusFilter(tab.value)}
                className={cn(
                  "flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all",
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
        <div className="flex gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-56">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Buscar campaña..."
              className="pl-9 h-9 text-sm"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <Button onClick={() => setShowForm(true)} className="bg-blue-600 hover:bg-blue-700 text-white h-9 px-4 text-xs font-semibold shrink-0">
            <Plus className="h-3.5 w-3.5 mr-1.5" /> Nueva
          </Button>
        </div>
      </div>

      {/* ═══ Content ═══ */}
      {isLoading && campaignsList.length === 0 ? (
        <div className="grid gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="animate-pulse border-slate-100 dark:border-slate-800">
              <CardContent className="p-5">
                <div className="flex gap-4">
                  <div className="w-10 h-10 bg-slate-200 dark:bg-slate-700 rounded-xl shrink-0" />
                  <div className="flex-1 space-y-2.5">
                    <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded-lg w-1/3" />
                    <div className="h-3 bg-slate-100 dark:bg-slate-800 rounded-lg w-2/3" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : campaignsList.length === 0 ? (
        /* ─── Empty State ─── */
        <Card className="border-dashed border-2 border-slate-200 dark:border-slate-700">
          <CardContent className="py-16 text-center">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-100 to-indigo-100 dark:from-blue-900/30 dark:to-indigo-900/30 flex items-center justify-center mx-auto mb-5">
              <Mail className="w-8 h-8 text-blue-600 dark:text-blue-400" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1.5">
              {searchQuery ? 'Sin resultados' : '¡Crea tu primera campaña!'}
            </h3>
            <p className="text-sm text-slate-500 max-w-sm mx-auto mb-6">
              {searchQuery
                ? `No encontramos campañas con "${searchQuery}".`
                : 'Diseña emails profesionales y envíalos a tus clientes en minutos.'
              }
            </p>
            {!searchQuery && (
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Button onClick={() => setShowForm(true)} className="bg-blue-600 hover:bg-blue-700 text-white h-10 px-5 text-sm font-semibold">
                  <Plus className="h-4 w-4 mr-2" /> Crear Campaña Manual
                </Button>
                <Button variant="outline" onClick={() => document.querySelector<HTMLInputElement>('[placeholder*="Oferta"]')?.focus()} className="h-10 px-5 text-sm font-semibold">
                  <Sparkles className="h-4 w-4 mr-2" /> Crear con Clivi IA
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        /* ─── Campaign List ─── */
        <div className="space-y-2">
          {campaignsList.map((campaign: any) => {
            const sentCount = campaign.recipients?.filter((r: any) => r.status === 'SENT').length || 0
            const totalRecipients = campaign.recipients?.length || 0
            const progress = totalRecipients > 0 ? (sentCount / totalRecipients) * 100 : 0

            return (
              <Card
                key={campaign.id}
                className="group border-slate-100 dark:border-slate-800 hover:border-blue-200 dark:hover:border-blue-800 transition-all cursor-pointer"
                onClick={() => setSelectedCampaign(campaign.id)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    {/* Icon */}
                    <div className={cn(
                      "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
                      campaign.status === 'SENT' ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600' :
                      campaign.status === 'SENDING' ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600' :
                      'bg-slate-100 dark:bg-slate-800 text-slate-400'
                    )}>
                      <Mail className="w-5 h-5" />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <h3 className="font-semibold text-sm text-slate-900 dark:text-white truncate">{campaign.name}</h3>
                        <Badge className={cn("text-[10px] font-semibold shrink-0 px-2 py-0.5", getStatusColor(campaign.status))}>
                          {getStatusLabel(campaign.status)}
                        </Badge>
                      </div>
                      <p className="text-xs text-slate-500 truncate">{campaign.subject}</p>
                      <div className="flex items-center gap-3 mt-1.5 text-[11px] text-slate-400">
                        <span>{formatDate(campaign.createdAt)}</span>
                        {totalRecipients > 0 && (
                          <span className="flex items-center gap-1">
                            <Users className="w-3 h-3" /> {sentCount}/{totalRecipients}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Progress (compact) */}
                    {totalRecipients > 0 && (
                      <div className="hidden sm:flex flex-col items-end gap-1 shrink-0 w-24">
                        <span className="text-[10px] font-medium text-slate-400">{Math.round(progress)}%</span>
                        <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className={cn("h-full rounded-full", progress === 100 ? 'bg-emerald-500' : progress > 0 ? 'bg-blue-500' : 'bg-slate-300')}
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                      </div>
                    )}

                    {/* Actions — always visible */}
                    <div className="flex items-center gap-0.5 shrink-0" onClick={e => e.stopPropagation()}>
                      {campaign.status === 'DRAFT' && (
                        <>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => {
                            setEditingCampaignId(campaign.id)
                            setShowForm(true)
                          }} title="Editar">
                            <Edit className="h-3.5 w-3.5 text-slate-400" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={async () => {
                            const ok = await confirm({
                              title: '¿Eliminar esta campaña?',
                              description: `"${campaign.name}" se eliminará permanentemente, incluyendo sus destinatarios y estadísticas.`,
                              confirmText: 'Eliminar',
                              variant: 'danger',
                            })
                            if (ok) deleteMutation.mutate(campaign.id)
                          }} title="Eliminar">
                            <Trash2 className="h-3.5 w-3.5 text-red-400" />
                          </Button>
                        </>
                      )}
                      <ChevronRight className="w-4 h-4 text-slate-300 dark:text-slate-600 ml-1" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      <ConfirmDialog />
    </div>
  )
}
