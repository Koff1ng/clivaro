'use client'

import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Megaphone,
  Plus,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Clock,
  Pause,
  Play,
  Settings,
  ExternalLink,
  Zap,
  Eye,
  Target,
  DollarSign,
  RefreshCw,
} from 'lucide-react'

function statusBadge(status: string) {
  const map: Record<string, { label: string; variant: string; icon: any }> = {
    PROCESSING: { label: 'Procesando', variant: 'bg-amber-100 text-amber-700', icon: Clock },
    ACTIVE: { label: 'Activa', variant: 'bg-green-100 text-green-700', icon: CheckCircle2 },
    PAUSED: { label: 'Pausada', variant: 'bg-slate-100 text-slate-600', icon: Pause },
    ERROR: { label: 'Error', variant: 'bg-red-100 text-red-700', icon: AlertCircle },
  }
  const config = map[status] || map.PROCESSING
  const Icon = config.icon
  return (
    <Badge className={`${config.variant} gap-1 font-medium`}>
      <Icon className="w-3 h-3" />
      {config.label}
    </Badge>
  )
}

function formatCOP(amount: number) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(amount)
}

export default function MetaAdsPage() {
  const queryClient = useQueryClient()

  // Fetch campaigns
  const { data: campaigns = [], isLoading } = useQuery({
    queryKey: ['meta-ads-campaigns'],
    queryFn: async () => {
      const res = await fetch('/api/marketing/meta-ads')
      if (!res.ok) throw new Error('Error cargando campañas')
      return res.json()
    },
    refetchInterval: 5000, // Poll for status updates
  })

  // Toggle pause/resume
  const toggleMutation = useMutation({
    mutationFn: async ({ trackingId, action }: { trackingId: string; action: 'pause' | 'resume' }) => {
      const res = await fetch(`/api/marketing/meta-ads/${trackingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Error')
      }
      return res.json()
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['meta-ads-campaigns'] }),
  })

  const activeCampaigns = campaigns.filter((c: any) => c.status === 'ACTIVE').length
  const totalBudget = campaigns.reduce((sum: number, c: any) => c.status === 'ACTIVE' ? sum + c.dailyBudget : sum, 0)

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Megaphone className="w-6 h-6 text-blue-600" />
            Meta Ads
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Crea y gestiona campañas de Facebook e Instagram Ads desde Clivaro
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => queryClient.invalidateQueries({ queryKey: ['meta-ads-campaigns'] })}>
            <RefreshCw className="w-4 h-4 mr-1" />
            Actualizar
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Campañas</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{campaigns.length}</div>
            <p className="text-xs text-muted-foreground">{activeCampaigns} activas</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Presupuesto Diario Total</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCOP(totalBudget)}</div>
            <p className="text-xs text-muted-foreground">Campañas activas</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Estado</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">Conectado</div>
            <p className="text-xs text-muted-foreground">Meta Marketing API</p>
          </CardContent>
        </Card>
      </div>

      {/* Campaigns List */}
      <Card>
        <CardHeader>
          <CardTitle>Campañas</CardTitle>
          <CardDescription>Todas tus campañas de Meta Ads</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : campaigns.length === 0 ? (
            <div className="text-center py-12">
              <Megaphone className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-40" />
              <h3 className="text-lg font-semibold mb-1">Sin campañas</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Crea tu primera campaña de Facebook/Instagram Ads
              </p>
              <p className="text-xs text-muted-foreground">
                Conecta tu cuenta de Meta desde Configuración → Meta Ads para empezar
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {campaigns.map((campaign: any) => (
                <div
                  key={campaign.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-4 min-w-0 flex-1">
                    <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                      <Megaphone className="w-5 h-5 text-blue-600" />
                    </div>
                    <div className="min-w-0">
                      <h4 className="font-medium truncate">{campaign.name}</h4>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                        <span>{campaign.objective.replace('OUTCOME_', '')}</span>
                        <span>•</span>
                        <span>{formatCOP(campaign.dailyBudget)}/día</span>
                        <span>•</span>
                        <span>{new Date(campaign.createdAt).toLocaleDateString('es-CO')}</span>
                      </div>
                      {campaign.errorMessage && (
                        <p className="text-xs text-red-500 mt-1">{campaign.errorMessage}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3 flex-shrink-0">
                    {statusBadge(campaign.status)}
                    
                    {campaign.status === 'ACTIVE' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleMutation.mutate({ trackingId: campaign.trackingId, action: 'pause' })}
                        disabled={toggleMutation.isPending}
                      >
                        <Pause className="w-4 h-4" />
                      </Button>
                    )}
                    {campaign.status === 'PAUSED' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleMutation.mutate({ trackingId: campaign.trackingId, action: 'resume' })}
                        disabled={toggleMutation.isPending}
                      >
                        <Play className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
