'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Megaphone,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Clock,
  Pause,
  Play,
  ExternalLink,
  Zap,
  Target,
  DollarSign,
  RefreshCw,
  Link2,
  Unlink,
  ArrowRight,
  ShieldCheck,
  Globe,
  Eye,
  EyeOff,
} from 'lucide-react'

// ── Helpers ──

function statusBadge(status: string) {
  const map: Record<string, { label: string; cls: string; icon: any }> = {
    PROCESSING: { label: 'Procesando', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400', icon: Clock },
    ACTIVE: { label: 'Activa', cls: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400', icon: CheckCircle2 },
    PAUSED: { label: 'Pausada', cls: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400', icon: Pause },
    ERROR: { label: 'Error', cls: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400', icon: AlertCircle },
  }
  const config = map[status] || map.PROCESSING
  const Icon = config.icon
  return (
    <Badge className={`${config.cls} gap-1 font-medium`}>
      <Icon className="w-3 h-3" />
      {config.label}
    </Badge>
  )
}

function formatCOP(amount: number) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(amount)
}

// ── Meta Connect Card ──

function MetaConnectCard({ onConnected }: { onConnected: () => void }) {
  const [step, setStep] = useState<'intro' | 'form'>('intro')
  const [token, setToken] = useState('')
  const [adAccount, setAdAccount] = useState('')
  const [pageId, setPageId] = useState('')
  const [showToken, setShowToken] = useState(false)
  const [error, setError] = useState('')

  const connectMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/marketing/meta-ads/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accessToken: token.trim(),
          adAccountId: adAccount.trim().startsWith('act_') ? adAccount.trim() : `act_${adAccount.trim()}`,
          pageId: pageId.trim() || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error al conectar')
      return data
    },
    onSuccess: () => {
      setError('')
      onConnected()
    },
    onError: (e: Error) => setError(e.message),
  })

  if (step === 'intro') {
    return (
      <div className="flex items-center justify-center py-12">
        <Card className="max-w-lg w-full border-0 shadow-xl bg-gradient-to-br from-white to-slate-50 dark:from-slate-900 dark:to-slate-950">
          <CardContent className="pt-10 pb-8 px-8 text-center">
            {/* Meta logo */}
            <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-blue-500 via-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
              <svg viewBox="0 0 24 24" className="w-10 h-10 text-white" fill="currentColor">
                <path d="M12 2.04C6.5 2.04 2 6.53 2 12.06C2 17.06 5.66 21.21 10.44 21.96V14.96H7.9V12.06H10.44V9.85C10.44 7.34 11.93 5.96 14.22 5.96C15.31 5.96 16.45 6.15 16.45 6.15V8.62H15.19C13.95 8.62 13.56 9.39 13.56 10.18V12.06H16.34L15.89 14.96H13.56V21.96A10 10 0 0 0 22 12.06C22 6.53 17.5 2.04 12 2.04Z" />
              </svg>
            </div>

            <h2 className="text-2xl font-bold mb-2">Conecta tu cuenta de Meta</h2>
            <p className="text-sm text-muted-foreground mb-8 max-w-sm mx-auto">
              Publica anuncios en Facebook e Instagram directamente desde Clivaro, sin necesidad de entrar al Ads Manager.
            </p>

            {/* Benefits */}
            <div className="grid grid-cols-1 gap-3 mb-8 text-left">
              {[
                { icon: Zap, text: 'Crea campañas en segundos', sub: 'Sin necesidad de experiencia en Meta Ads' },
                { icon: Target, text: 'Segmentación inteligente', sub: 'Advantage+ optimiza tu audiencia automáticamente' },
                { icon: ShieldCheck, text: 'Seguro y encriptado', sub: 'Tu token se almacena de forma segura' },
              ].map((item, i) => (
                <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-white/60 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                  <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
                    <item.icon className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{item.text}</p>
                    <p className="text-xs text-muted-foreground">{item.sub}</p>
                  </div>
                </div>
              ))}
            </div>

            <Button
              onClick={() => setStep('form')}
              className="w-full py-6 text-base font-semibold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-lg shadow-blue-500/20"
            >
              <Link2 className="w-5 h-5 mr-2" />
              Conectar con Meta
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>

            <p className="text-xs text-muted-foreground mt-4">
              Necesitas una{' '}
              <a
                href="https://business.facebook.com/settings"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline inline-flex items-center gap-0.5"
              >
                cuenta de Meta Business
                <ExternalLink className="w-3 h-3" />
              </a>
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Form step
  return (
    <div className="flex items-center justify-center py-8">
      <Card className="max-w-lg w-full border shadow-lg">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-3 mb-2">
            <button
              onClick={() => setStep('intro')}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              ← Volver
            </button>
          </div>
          <CardTitle className="text-xl">Datos de conexión</CardTitle>
          <CardDescription>
            Ingresa los datos de tu cuenta publicitaria de Meta. Los encuentras en{' '}
            <a
              href="https://business.facebook.com/settings/ad-accounts"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline inline-flex items-center gap-0.5"
            >
              Meta Business Suite
              <ExternalLink className="w-3 h-3" />
            </a>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Access Token */}
          <div className="space-y-2">
            <Label htmlFor="token" className="text-sm font-medium">
              Access Token <span className="text-red-500">*</span>
            </Label>
            <div className="relative">
              <Input
                id="token"
                type={showToken ? 'text' : 'password'}
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="EAAxxxxxxxx..."
                className="pr-10 font-mono text-sm"
              />
              <button
                type="button"
                onClick={() => setShowToken(!showToken)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              Genera un token de System User en{' '}
              <a href="https://business.facebook.com/settings/system-users" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                System Users
              </a>
              {' '}con el permiso <code className="text-xs bg-muted px-1 rounded">ads_management</code>
            </p>
          </div>

          {/* Ad Account ID */}
          <div className="space-y-2">
            <Label htmlFor="adAccount" className="text-sm font-medium">
              ID de Cuenta Publicitaria <span className="text-red-500">*</span>
            </Label>
            <div className="flex items-center gap-1">
              <span className="text-sm text-muted-foreground font-mono bg-muted px-2 py-2 rounded-l-md border border-r-0">act_</span>
              <Input
                id="adAccount"
                value={adAccount.replace('act_', '')}
                onChange={(e) => setAdAccount(e.target.value.replace('act_', ''))}
                placeholder="123456789"
                className="font-mono text-sm rounded-l-none"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Lo encuentras en Meta Business Suite → Configuración → Cuentas publicitarias
            </p>
          </div>

          {/* Page ID (optional) */}
          <div className="space-y-2">
            <Label htmlFor="pageId" className="text-sm font-medium flex items-center gap-1">
              <Globe className="w-3.5 h-3.5" />
              ID de Página de Facebook
              <span className="text-xs text-muted-foreground font-normal">(opcional)</span>
            </Label>
            <Input
              id="pageId"
              value={pageId}
              onChange={(e) => setPageId(e.target.value)}
              placeholder="ID numérico de tu página"
              className="font-mono text-sm"
            />
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
              <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
            </div>
          )}

          {/* Submit */}
          <Button
            onClick={() => connectMutation.mutate()}
            disabled={!token.trim() || !adAccount.trim() || connectMutation.isPending}
            className="w-full py-5 font-semibold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
          >
            {connectMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Verificando conexión...
              </>
            ) : (
              <>
                <ShieldCheck className="w-4 h-4 mr-2" />
                Conectar y verificar
              </>
            )}
          </Button>

          <p className="text-xs text-center text-muted-foreground">
            Verificaremos tu token haciendo una lectura de prueba a tu cuenta publicitaria
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

// ── Main Page ──

export default function MetaAdsPage() {
  const queryClient = useQueryClient()

  // Check if Meta is connected
  const { data: connectionStatus, isLoading: checkingConnection } = useQuery({
    queryKey: ['meta-ads-connection'],
    queryFn: async () => {
      const res = await fetch('/api/marketing/meta-ads/connect')
      if (!res.ok) return { connected: false }
      return res.json()
    },
  })

  // Fetch campaigns (only when connected)
  const { data: campaigns = [], isLoading } = useQuery({
    queryKey: ['meta-ads-campaigns'],
    queryFn: async () => {
      const res = await fetch('/api/marketing/meta-ads')
      if (!res.ok) return []
      return res.json()
    },
    enabled: connectionStatus?.connected === true,
    refetchInterval: 5000,
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

  if (checkingConnection) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  // Show connection UI if not connected
  if (!connectionStatus?.connected) {
    return (
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Megaphone className="w-6 h-6 text-blue-600" />
            Meta Ads
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Conecta tu cuenta para publicar anuncios en Facebook e Instagram
          </p>
        </div>
        <MetaConnectCard onConnected={() => queryClient.invalidateQueries({ queryKey: ['meta-ads-connection'] })} />
      </div>
    )
  }

  // Connected — show dashboard
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
            Gestiona tus campañas de Facebook e Instagram Ads
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
            <CardTitle className="text-sm font-medium">Presupuesto Diario</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCOP(totalBudget)}</div>
            <p className="text-xs text-muted-foreground">Campañas activas</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Conexión</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 gap-1">
                <CheckCircle2 className="w-3 h-3" />
                Conectado
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-1">{connectionStatus.adAccountId}</p>
          </CardContent>
        </Card>
      </div>

      {/* Campaigns List */}
      <Card>
        <CardHeader>
          <CardTitle>Campañas</CardTitle>
          <CardDescription>Todas tus campañas creadas desde Clivaro</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : campaigns.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-blue-100 dark:bg-blue-900/20 flex items-center justify-center">
                <Megaphone className="w-8 h-8 text-blue-500 opacity-60" />
              </div>
              <h3 className="text-lg font-semibold mb-1">Todo listo</h3>
              <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                Tu cuenta de Meta está conectada. Las campañas que crees aparecerán aquí.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {campaigns.map((campaign: any) => (
                <div
                  key={campaign.id}
                  className="flex items-center justify-between p-4 border rounded-xl hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-4 min-w-0 flex-1">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center flex-shrink-0">
                      <Megaphone className="w-5 h-5 text-white" />
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
                        <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" />
                          {campaign.errorMessage}
                        </p>
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
                        title="Pausar campaña"
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
                        title="Reanudar campaña"
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
