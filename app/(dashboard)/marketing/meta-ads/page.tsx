'use client'

import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Megaphone, Loader2, AlertCircle, CheckCircle2, Clock, Pause, Play,
  ExternalLink, Zap, Target, DollarSign, RefreshCw, Link2, ArrowRight,
  ShieldCheck, Globe, Eye, EyeOff, Plus, ArrowLeft, Image as ImageIcon,
  MousePointerClick, Users, Heart, ShoppingBag, Radio, Trash2, BarChart3,
  TrendingUp, X,
} from 'lucide-react'
import { useToast } from '@/components/ui/toast'
import { PageHeader } from '@/components/ui/page-header'

// ── Helpers ──

function statusBadge(status: string) {
  const map: Record<string, { label: string; cls: string; icon: any }> = {
    PROCESSING: { label: 'Procesando', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400', icon: Clock },
    ACTIVE: { label: 'Activa', cls: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400', icon: CheckCircle2 },
    PAUSED: { label: 'Pausada', cls: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400', icon: Pause },
    ERROR: { label: 'Error', cls: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400', icon: AlertCircle },
  }
  const c = map[status] || map.PROCESSING
  const Icon = c.icon
  return <Badge className={`${c.cls} gap-1 font-medium`}><Icon className="w-3 h-3" />{c.label}</Badge>
}

function formatCOP(amount: number) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(amount)
}

// ── Objectives ──
const OBJECTIVES = [
  { value: 'OUTCOME_AWARENESS', label: 'Reconocimiento', desc: 'Llega al mayor número de personas', icon: Eye, color: 'from-purple-500 to-indigo-500' },
  { value: 'OUTCOME_TRAFFIC', label: 'Tráfico', desc: 'Lleva visitantes a tu sitio web', icon: MousePointerClick, color: 'from-blue-500 to-cyan-500' },
  { value: 'OUTCOME_ENGAGEMENT', label: 'Interacción', desc: 'Más likes, comentarios y shares', icon: Heart, color: 'from-pink-500 to-rose-500' },
  { value: 'OUTCOME_LEADS', label: 'Clientes potenciales', desc: 'Captura datos de contacto', icon: Users, color: 'from-green-500 to-emerald-500' },
  { value: 'OUTCOME_SALES', label: 'Ventas', desc: 'Impulsa compras en tu tienda', icon: ShoppingBag, color: 'from-orange-500 to-amber-500' },
]

const CTA_OPTIONS = [
  { value: 'LEARN_MORE', label: 'Más información' },
  { value: 'SHOP_NOW', label: 'Comprar ahora' },
  { value: 'SIGN_UP', label: 'Registrarse' },
  { value: 'CONTACT_US', label: 'Contáctanos' },
  { value: 'BOOK_NOW', label: 'Reservar ahora' },
  { value: 'GET_QUOTE', label: 'Obtener cotización' },
  { value: 'SEND_MESSAGE', label: 'Enviar mensaje' },
]

// ── Campaign Wizard ──

interface CampaignForm {
  name: string
  objective: string
  targetCountries: string[]
  targetAgeMin: number
  targetAgeMax: number
  targetGenders: number[]
  headline: string
  bodyText: string
  callToAction: string
  imageUrl: string
  linkUrl: string
  dailyBudget: number
  startDate: string
  endDate: string
}

const defaultForm: CampaignForm = {
  name: '',
  objective: '',
  targetCountries: ['CO'],
  targetAgeMin: 18,
  targetAgeMax: 65,
  targetGenders: [0],
  headline: '',
  bodyText: '',
  callToAction: 'LEARN_MORE',
  imageUrl: '',
  linkUrl: '',
  dailyBudget: 20000,
  startDate: new Date().toISOString().split('T')[0],
  endDate: '',
}

function CampaignWizard({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [step, setStep] = useState(0)
  const [form, setForm] = useState<CampaignForm>(defaultForm)
  const [error, setError] = useState('')

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/marketing/meta-ads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error')
      return data
    },
    onSuccess: () => { onCreated(); onClose() },
    onError: (e: Error) => setError(e.message),
  })

  const upd = (field: keyof CampaignForm, value: any) => setForm(prev => ({ ...prev, [field]: value }))
  const steps = ['Objetivo', 'Audiencia', 'Anuncio', 'Presupuesto']

  const canNext = () => {
    if (step === 0) return !!form.objective && !!form.name
    if (step === 1) return form.targetCountries.length > 0
    if (step === 2) return !!form.headline && !!form.bodyText && !!form.linkUrl
    if (step === 3) return form.dailyBudget >= 5000
    return true
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-background border rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div>
            <h2 className="text-lg font-bold">Nueva Campaña</h2>
            <div className="flex items-center gap-2 mt-2">
              {steps.map((s, i) => (
                <div key={i} className="flex items-center gap-1">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                    i < step ? 'bg-green-500 text-white' : i === step ? 'bg-blue-600 text-white' : 'bg-muted text-muted-foreground'
                  }`}>{i < step ? '✓' : i + 1}</div>
                  <span className={`text-xs font-medium hidden sm:inline ${i === step ? 'text-foreground' : 'text-muted-foreground'}`}>{s}</span>
                  {i < steps.length - 1 && <div className="w-4 h-px bg-border mx-1" />}
                </div>
              ))}
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="w-4 h-4" /></Button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          {/* Step 0: Objective */}
          {step === 0 && (
            <>
              <div className="space-y-2">
                <Label>Nombre de la campaña <span className="text-red-500">*</span></Label>
                <Input value={form.name} onChange={e => upd('name', e.target.value)} placeholder="Ej: Promo Navidad 2026" />
              </div>
              <div className="space-y-2">
                <Label>¿Qué quieres lograr? <span className="text-red-500">*</span></Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {OBJECTIVES.map(obj => {
                    const Icon = obj.icon
                    const selected = form.objective === obj.value
                    return (
                      <button key={obj.value} onClick={() => upd('objective', obj.value)}
                        className={`flex items-start gap-3 p-4 rounded-xl border-2 text-left transition-all ${
                          selected ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-transparent bg-muted/50 hover:border-muted-foreground/20'
                        }`}>
                        <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${obj.color} flex items-center justify-center flex-shrink-0`}>
                          <Icon className="w-5 h-5 text-white" />
                        </div>
                        <div>
                          <p className="font-semibold text-sm">{obj.label}</p>
                          <p className="text-xs text-muted-foreground">{obj.desc}</p>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            </>
          )}

          {/* Step 1: Audience */}
          {step === 1 && (
            <>
              <div className="space-y-2">
                <Label>País <span className="text-red-500">*</span></Label>
                <Select value={form.targetCountries[0]} onValueChange={v => upd('targetCountries', [v])}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CO">🇨🇴 Colombia</SelectItem>
                    <SelectItem value="MX">🇲🇽 México</SelectItem>
                    <SelectItem value="US">🇺🇸 Estados Unidos</SelectItem>
                    <SelectItem value="ES">🇪🇸 España</SelectItem>
                    <SelectItem value="AR">🇦🇷 Argentina</SelectItem>
                    <SelectItem value="CL">🇨🇱 Chile</SelectItem>
                    <SelectItem value="PE">🇵🇪 Perú</SelectItem>
                    <SelectItem value="EC">🇪🇨 Ecuador</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Edad mínima</Label>
                  <Input type="number" min={13} max={65} value={form.targetAgeMin} onChange={e => upd('targetAgeMin', parseInt(e.target.value) || 18)} />
                </div>
                <div className="space-y-2">
                  <Label>Edad máxima</Label>
                  <Input type="number" min={13} max={65} value={form.targetAgeMax} onChange={e => upd('targetAgeMax', parseInt(e.target.value) || 65)} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Género</Label>
                <div className="flex gap-2">
                  {[{ v: [0], l: 'Todos' }, { v: [1], l: 'Hombres' }, { v: [2], l: 'Mujeres' }].map(g => (
                    <button key={g.l} onClick={() => upd('targetGenders', g.v)}
                      className={`px-4 py-2 rounded-lg text-sm font-medium border transition-all ${
                        JSON.stringify(form.targetGenders) === JSON.stringify(g.v)
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400'
                          : 'border-border hover:border-muted-foreground/30'
                      }`}>{g.l}</button>
                  ))}
                </div>
              </div>
              <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800">
                <p className="text-xs text-blue-700 dark:text-blue-400 flex items-center gap-1">
                  <Zap className="w-3 h-3" /> <strong>Advantage+</strong> optimizará tu audiencia automáticamente basándose en estos parámetros iniciales.
                </p>
              </div>
            </>
          )}

          {/* Step 2: Creative */}
          {step === 2 && (
            <>
              <div className="space-y-2">
                <Label>Título del anuncio <span className="text-red-500">*</span></Label>
                <Input value={form.headline} onChange={e => upd('headline', e.target.value)} placeholder="Ej: ¡50% OFF en toda la tienda!" maxLength={40} />
                <p className="text-xs text-muted-foreground text-right">{form.headline.length}/40</p>
              </div>
              <div className="space-y-2">
                <Label>Texto del anuncio <span className="text-red-500">*</span></Label>
                <Textarea value={form.bodyText} onChange={e => upd('bodyText', e.target.value)} placeholder="Describe tu oferta o producto..." rows={3} maxLength={125} />
                <p className="text-xs text-muted-foreground text-right">{form.bodyText.length}/125</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>URL de destino <span className="text-red-500">*</span></Label>
                  <Input value={form.linkUrl} onChange={e => upd('linkUrl', e.target.value)} placeholder="https://tu-tienda.com" type="url" />
                </div>
                <div className="space-y-2">
                  <Label>Botón (CTA)</Label>
                  <Select value={form.callToAction} onValueChange={v => upd('callToAction', v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CTA_OPTIONS.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-1"><ImageIcon className="w-3.5 h-3.5" /> URL de imagen (opcional)</Label>
                <Input value={form.imageUrl} onChange={e => upd('imageUrl', e.target.value)} placeholder="https://example.com/imagen.jpg" />
              </div>

              {/* Ad Preview */}
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground uppercase tracking-wider">Vista previa</Label>
                <div className="border rounded-xl p-4 bg-white dark:bg-slate-900 max-w-sm">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center"><Megaphone className="w-4 h-4 text-white" /></div>
                    <div><p className="text-xs font-semibold">Tu Negocio</p><p className="text-[10px] text-muted-foreground">Publicidad · 🌐</p></div>
                  </div>
                  <p className="text-sm mb-2">{form.bodyText || 'Texto de tu anuncio...'}</p>
                  {form.imageUrl && <div className="w-full h-40 bg-muted rounded-lg mb-2 overflow-hidden"><img src={form.imageUrl} alt="ad" className="w-full h-full object-cover" /></div>}
                  {!form.imageUrl && <div className="w-full h-40 bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-900 rounded-lg mb-2 flex items-center justify-center"><ImageIcon className="w-8 h-8 text-muted-foreground/40" /></div>}
                  <div className="flex items-center justify-between p-2 bg-muted/50 rounded-lg">
                    <div><p className="text-xs font-bold truncate">{form.headline || 'Título del anuncio'}</p><p className="text-[10px] text-muted-foreground truncate">{form.linkUrl || 'tu-sitio.com'}</p></div>
                    <Button size="sm" className="text-xs h-7 bg-blue-600 hover:bg-blue-700">{CTA_OPTIONS.find(c => c.value === form.callToAction)?.label || 'Más info'}</Button>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Step 3: Budget */}
          {step === 3 && (
            <>
              <div className="space-y-2">
                <Label>Presupuesto diario (COP) <span className="text-red-500">*</span></Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                  <Input type="number" min={5000} step={1000} value={form.dailyBudget} onChange={e => upd('dailyBudget', parseInt(e.target.value) || 0)} className="pl-7 text-lg font-bold" />
                </div>
                <p className="text-xs text-muted-foreground">Mínimo recomendado: $5.000 COP/día</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Fecha de inicio</Label>
                  <Input type="date" value={form.startDate} onChange={e => upd('startDate', e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Fecha de fin (opcional)</Label>
                  <Input type="date" value={form.endDate} onChange={e => upd('endDate', e.target.value)} />
                </div>
              </div>

              {/* Summary */}
              <div className="p-4 rounded-xl border bg-muted/30 space-y-3">
                <h4 className="font-bold text-sm">Resumen de campaña</h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="text-muted-foreground">Nombre:</div><div className="font-medium">{form.name}</div>
                  <div className="text-muted-foreground">Objetivo:</div><div className="font-medium">{OBJECTIVES.find(o => o.value === form.objective)?.label}</div>
                  <div className="text-muted-foreground">País:</div><div className="font-medium">{form.targetCountries[0]}</div>
                  <div className="text-muted-foreground">Audiencia:</div><div className="font-medium">{form.targetAgeMin}-{form.targetAgeMax} años</div>
                  <div className="text-muted-foreground">Presupuesto:</div><div className="font-medium text-green-600">{formatCOP(form.dailyBudget)}/día</div>
                  <div className="text-muted-foreground">Título:</div><div className="font-medium truncate">{form.headline}</div>
                </div>
              </div>

              {error && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                  <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" /><p className="text-sm text-red-700 dark:text-red-400">{error}</p>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t">
          <Button variant="ghost" onClick={() => step === 0 ? onClose() : setStep(step - 1)}>
            <ArrowLeft className="w-4 h-4 mr-1" />{step === 0 ? 'Cancelar' : 'Atrás'}
          </Button>
          {step < 3 ? (
            <Button onClick={() => setStep(step + 1)} disabled={!canNext()} className="bg-blue-600 hover:bg-blue-700">
              Siguiente <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          ) : (
            <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending || !canNext()}
              className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 px-8">
              {createMutation.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Publicando...</> : <><Zap className="w-4 h-4 mr-2" />Publicar Campaña</>}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
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
          pageId: pageId.trim(),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error al conectar')
      return data
    },
    onSuccess: () => { setError(''); onConnected() },
    onError: (e: Error) => setError(e.message),
  })

  if (step === 'intro') {
    return (
      <div className="flex items-center justify-center py-12">
        <Card className="max-w-lg w-full border-0 shadow-xl bg-gradient-to-br from-white to-slate-50 dark:from-slate-900 dark:to-slate-950">
          <CardContent className="pt-10 pb-8 px-8 text-center">
            <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-blue-500 via-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
              <svg viewBox="0 0 24 24" className="w-10 h-10 text-white" fill="currentColor">
                <path d="M12 2.04C6.5 2.04 2 6.53 2 12.06C2 17.06 5.66 21.21 10.44 21.96V14.96H7.9V12.06H10.44V9.85C10.44 7.34 11.93 5.96 14.22 5.96C15.31 5.96 16.45 6.15 16.45 6.15V8.62H15.19C13.95 8.62 13.56 9.39 13.56 10.18V12.06H16.34L15.89 14.96H13.56V21.96A10 10 0 0 0 22 12.06C22 6.53 17.5 2.04 12 2.04Z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold mb-2">Conecta tu cuenta de Meta</h2>
            <p className="text-sm text-muted-foreground mb-8 max-w-sm mx-auto">
              Publica anuncios en Facebook e Instagram directamente desde Clivaro, sin entrar al Ads Manager.
            </p>
            <div className="grid grid-cols-1 gap-3 mb-8 text-left">
              {[
                { icon: Zap, text: 'Crea campañas en segundos', sub: 'Sin necesidad de experiencia en Meta Ads' },
                { icon: Target, text: 'Segmentación inteligente', sub: 'Advantage+ optimiza tu audiencia' },
                { icon: ShieldCheck, text: 'Seguro y encriptado', sub: 'Tu token se almacena de forma segura' },
              ].map((item, i) => (
                <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-white/60 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                  <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
                    <item.icon className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div><p className="text-sm font-medium">{item.text}</p><p className="text-xs text-muted-foreground">{item.sub}</p></div>
                </div>
              ))}
            </div>
            <Button onClick={() => setStep('form')} className="w-full py-6 text-base font-semibold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-lg shadow-blue-500/20">
              <Link2 className="w-5 h-5 mr-2" />Conectar con Meta<ArrowRight className="w-4 h-4 ml-2" />
            </Button>
            <p className="text-xs text-muted-foreground mt-4">Necesitas una <a href="https://business.facebook.com/settings" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline inline-flex items-center gap-0.5">cuenta de Meta Business<ExternalLink className="w-3 h-3" /></a></p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex items-center justify-center py-8">
      <Card className="max-w-lg w-full border shadow-lg">
        <CardHeader className="pb-4">
          <button onClick={() => setStep('intro')} className="text-sm text-muted-foreground hover:text-foreground mb-2">← Volver</button>
          <CardTitle className="text-xl">Datos de conexión</CardTitle>
          <CardDescription>Ingresa los datos de tu cuenta publicitaria de Meta.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="token">Access Token <span className="text-red-500">*</span></Label>
            <div className="relative">
              <Input id="token" type={showToken ? 'text' : 'password'} value={token} onChange={e => setToken(e.target.value)} placeholder="EAAxxxxxxxx..." className="pr-10 font-mono text-sm" />
              <button type="button" onClick={() => setShowToken(!showToken)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="adAccount">ID de Cuenta Publicitaria <span className="text-red-500">*</span></Label>
            <div className="flex items-center gap-1">
              <span className="text-sm text-muted-foreground font-mono bg-muted px-2 py-2 rounded-l-md border border-r-0">act_</span>
              <Input id="adAccount" value={adAccount.replace('act_', '')} onChange={e => setAdAccount(e.target.value.replace('act_', ''))} placeholder="123456789" className="font-mono text-sm rounded-l-none" />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="pageId" className="flex items-center gap-1"><Globe className="w-3.5 h-3.5" />ID de Página de Facebook <span className="text-red-500">*</span></Label>
            <Input id="pageId" value={pageId} onChange={e => setPageId(e.target.value)} placeholder="Ej: 123456789012345" className="font-mono text-sm" />
            <p className="text-xs text-muted-foreground">Encuéntralo en <a href="https://www.facebook.com/settings/?tab=linked_pages" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Configuración de Facebook → Páginas</a> o en la URL de tu página.</p>
          </div>
          {error && <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800"><AlertCircle className="w-4 h-4 text-red-500 mt-0.5" /><p className="text-sm text-red-700 dark:text-red-400">{error}</p></div>}
          <Button onClick={() => connectMutation.mutate()} disabled={!token.trim() || !adAccount.trim() || !pageId.trim() || connectMutation.isPending}
            className="w-full py-5 font-semibold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700">
            {connectMutation.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Verificando...</> : <><ShieldCheck className="w-4 h-4 mr-2" />Conectar y verificar</>}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

// ── Page ID Missing Alert ──

function PageIdAlert({ onSaved }: { onSaved: () => void }) {
  const [pageId, setPageId] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleSave = async () => {
    if (!pageId.trim()) return
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/marketing/meta-ads/connect', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pageId: pageId.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error')
      onSaved()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="p-4 rounded-xl border-2 border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/10 space-y-3">
      <div className="flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
        <div className="flex-1 space-y-2">
          <h4 className="font-semibold text-sm text-amber-800 dark:text-amber-400">Falta el ID de Página de Facebook</h4>
          <p className="text-xs text-amber-700 dark:text-amber-500">Para crear anuncios necesitas asociar una Página de Facebook. Búscalo en <a href="https://www.facebook.com/settings/?tab=linked_pages" target="_blank" rel="noopener noreferrer" className="underline font-medium">Configuración → Páginas</a> o copia el número de la URL de tu página.</p>
          <div className="flex gap-2">
            <Input value={pageId} onChange={e => setPageId(e.target.value)} placeholder="Ej: 123456789012345" className="font-mono text-sm max-w-xs" />
            <Button size="sm" onClick={handleSave} disabled={!pageId.trim() || saving} className="bg-amber-600 hover:bg-amber-700 text-white">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Guardar'}
            </Button>
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>
      </div>
    </div>
  )
}

// ── Main Page ──

export default function MetaAdsPage() {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [showWizard, setShowWizard] = useState(false)

  // Check connection status
  const { data: connectionStatus, isLoading: isLoadingConnection } = useQuery({
    queryKey: ['meta-ads-connection'],
    queryFn: async () => {
      const res = await fetch('/api/marketing/meta-ads/connect')
      return res.json()
    },
  })

  // Fetch campaigns (only if connected)
  const { data: campaigns = [], isLoading: isLoadingCampaigns, refetch: refetchCampaigns } = useQuery({
    queryKey: ['meta-ads-campaigns'],
    queryFn: async () => {
      const res = await fetch('/api/marketing/meta-ads')
      if (!res.ok) return []
      return res.json()
    },
    enabled: connectionStatus?.connected === true,
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/marketing/meta-ads/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Error al eliminar')
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meta-ads-campaigns'] })
      toast('Campaña eliminada', 'success')
    },
    onError: (e: Error) => toast(e.message, 'error'),
  })

  if (isLoadingConnection) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground mr-2" />
        <span className="text-muted-foreground">Cargando configuración de Meta Ads...</span>
      </div>
    )
  }

  // Not connected → show connect card
  if (!connectionStatus?.connected) {
    return (
      <div className="space-y-4">
        <PageHeader
          title="Meta Ads"
          description="Gestiona tus campañas de Facebook e Instagram directamente desde Clivaro."
          icon={<Radio className="h-5 w-5 text-blue-600" />}
        />
        <MetaConnectCard onConnected={() => queryClient.invalidateQueries({ queryKey: ['meta-ads-connection'] })} />
      </div>
    )
  }

  // Connected → show full module
  const activeCampaigns = Array.isArray(campaigns) ? campaigns.filter((c: any) => c.status === 'ACTIVE') : []
  const totalBudget = activeCampaigns.reduce((sum: number, c: any) => sum + (c.dailyBudget || 0), 0)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <PageHeader
          title="Meta Ads"
          description="Gestiona tus campañas de Facebook e Instagram directamente desde Clivaro."
          icon={<Radio className="h-5 w-5 text-blue-600" />}
        />
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => refetchCampaigns()}>
            <RefreshCw className="w-4 h-4 mr-1" />Actualizar
          </Button>
          <Button size="sm" className="bg-blue-600 hover:bg-blue-700" onClick={() => setShowWizard(true)}>
            <Plus className="w-4 h-4 mr-1" />Nueva Campaña
          </Button>
        </div>
      </div>

      {/* Page ID Alert */}
      {connectionStatus?.connected && !connectionStatus?.hasPageId && (
        <PageIdAlert onSaved={() => queryClient.invalidateQueries({ queryKey: ['meta-ads-connection'] })} />
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Campañas</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{Array.isArray(campaigns) ? campaigns.length : 0}</div>
            <p className="text-xs text-muted-foreground">{activeCampaigns.length} activas</p>
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
            <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 gap-1"><CheckCircle2 className="w-3 h-3" />Conectado</Badge>
            <p className="text-xs text-muted-foreground mt-1">{connectionStatus?.adAccountId}</p>
          </CardContent>
        </Card>
      </div>

      {/* Campaigns list */}
      <Card>
        <CardHeader>
          <CardTitle>Campañas</CardTitle>
          <CardDescription>Todas tus campañas creadas desde Clivaro</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingCampaigns ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground mr-2" />
              <span className="text-muted-foreground">Cargando campañas...</span>
            </div>
          ) : !Array.isArray(campaigns) || campaigns.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-blue-100 to-indigo-100 dark:from-blue-900/30 dark:to-indigo-900/30 flex items-center justify-center">
                <Megaphone className="w-7 h-7 text-blue-600 dark:text-blue-400" />
              </div>
              <h3 className="font-bold text-lg mb-1">No tienes campañas aún</h3>
              <p className="text-sm text-muted-foreground mb-4">Crea tu primera campaña de Facebook o Instagram en minutos.</p>
              <Button onClick={() => setShowWizard(true)} className="bg-blue-600 hover:bg-blue-700">
                <Plus className="w-4 h-4 mr-2" />Crear Primera Campaña
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {campaigns.map((c: any) => (
                <div key={c.id} className="flex items-center justify-between p-4 border rounded-xl hover:shadow-md transition-shadow group">
                  <div className="flex items-center gap-4 min-w-0 flex-1">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center flex-shrink-0">
                      <Megaphone className="w-5 h-5 text-white" />
                    </div>
                    <div className="min-w-0">
                      <h4 className="font-medium truncate">{c.name}</h4>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                        <span>{OBJECTIVES.find(o => o.value === c.objective)?.label || c.objective}</span>
                        <span>•</span>
                        <span>{formatCOP(c.dailyBudget || 0)}/día</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {statusBadge(c.status)}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="opacity-0 group-hover:opacity-100 transition-opacity text-red-500 hover:text-red-600"
                      onClick={() => {
                        if (confirm('¿Eliminar esta campaña?')) deleteMutation.mutate(c.id)
                      }}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Campaign Wizard */}
      {showWizard && (
        <CampaignWizard
          onClose={() => setShowWizard(false)}
          onCreated={() => {
            queryClient.invalidateQueries({ queryKey: ['meta-ads-campaigns'] })
            toast('🎉 Campaña publicada exitosamente', 'success')
          }}
        />
      )}
    </div>
  )
}
