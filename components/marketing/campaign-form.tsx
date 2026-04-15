'use client'

import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  Eye, Send, Save, Users, X, Check, FileText, Palette, Megaphone, Monitor, Smartphone,
  MailOpen, Sparkles, Loader2, ArrowRight, CheckCircle, XCircle, Clock, Trash2, Plus
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import EmailBuilder from '@/components/marketing/email-builder'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { useToast } from '@/components/ui/toast'
import { useSession } from 'next-auth/react'

const campaignSchema = z.object({
  name: z.string().min(1, 'El nombre es requerido'),
  subject: z.string().min(1, 'El asunto es requerido'),
  htmlContent: z.string().min(1, 'El contenido HTML es requerido'),
  scheduledAt: z.string().optional(),
})

type CampaignFormData = z.infer<typeof campaignSchema>

interface CampaignFormProps {
  campaignId?: string
  aiDefaults?: { name: string; subject: string; htmlContent: string; _blocks?: any[] }
  onClose: () => void
  onSuccess: (createdCampaignId?: string) => void
}

export default function CampaignForm({ campaignId, aiDefaults, onClose, onSuccess }: CampaignFormProps) {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const { data: session } = useSession()
  const [currentCampaignId, setCurrentCampaignId] = useState<string | null>(campaignId || null)
  const [showPreview, setShowPreview] = useState(false)
  const [previewMode, setPreviewMode] = useState<'desktop' | 'mobile'>('desktop')
  const [showSendTest, setShowSendTest] = useState(false)
  const [testEmail, setTestEmail] = useState<string>(((session?.user as any)?.email as string) || '')
  const [testName, setTestName] = useState<string>(((session?.user as any)?.name as string) || '')
  const [isDirtySinceSave, setIsDirtySinceSave] = useState(false)
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null)
  const [editorKey, setEditorKey] = useState(0)
  const [activeStep, setActiveStep] = useState(0) // 0=Info, 1=Design, 2=Recipients, 3=Send
  const [aiBlocks, setAiBlocks] = useState<any[] | undefined>(undefined)

  // Inline recipients state
  const [selectedCustomers, setSelectedCustomers] = useState<string[]>([])
  const [manualEmails, setManualEmails] = useState<string[]>([''])
  const [customerSearch, setCustomerSearch] = useState('')

  const effectiveId = currentCampaignId || campaignId

  const { register, handleSubmit, control, watch, setValue, formState: { errors } } = useForm<CampaignFormData>({
    resolver: zodResolver(campaignSchema),
    defaultValues: campaignId ? async () => {
      const res = await fetch(`/api/marketing/campaigns/${campaignId}`)
      const data = await res.json()
      return {
        name: data.name,
        subject: data.subject,
        htmlContent: data.htmlContent,
        scheduledAt: data.scheduledAt ? new Date(data.scheduledAt).toISOString().slice(0, 16) : '',
      }
    } : {
      name: '',
      subject: '',
      htmlContent: '',
      scheduledAt: '',
    },
  })

  const htmlContent = watch('htmlContent')
  const name = watch('name')
  const subject = watch('subject')
  const scheduledAt = watch('scheduledAt')

  useEffect(() => {
    setIsDirtySinceSave(true)
  }, [htmlContent, name, subject, scheduledAt])

  // Fetch customers for inline recipients
  const { data: customers } = useQuery({
    queryKey: ['customers-for-campaign'],
    queryFn: async () => {
      const res = await fetch('/api/customers?active=true')
      if (!res.ok) return []
      const data = await res.json()
      return data.customers?.filter((c: any) => c.email) || []
    },
    enabled: !!effectiveId, // Only fetch when campaign is saved
  })

  // Fetch campaign recipients when saved
  const { data: campaignData, refetch: refetchCampaign } = useQuery({
    queryKey: ['marketing-campaign', effectiveId],
    queryFn: async () => {
      const res = await fetch(`/api/marketing/campaigns/${effectiveId}`)
      if (!res.ok) return null
      return res.json()
    },
    enabled: !!effectiveId,
  })

  const recipients = campaignData?.recipients || []
  const pendingCount = recipients.filter((r: any) => r.status === 'PENDING').length
  const sentCount = recipients.filter((r: any) => r.status === 'SENT').length

  const filteredCustomers = useMemo(() => {
    if (!customers) return []
    if (!customerSearch) return customers
    const q = customerSearch.toLowerCase()
    return customers.filter((c: any) =>
      c.name?.toLowerCase().includes(q) || c.email?.toLowerCase().includes(q)
    )
  }, [customers, customerSearch])

  // ── Smooth AI fill animation ──
  const [isAiFilling, setIsAiFilling] = useState(false)
  const [aiFillingStep, setAiFillingStep] = useState<'name' | 'subject' | 'html' | 'done'>('done')

  useEffect(() => {
    if (!aiDefaults) return
    let cancelled = false
    setIsAiFilling(true)
    setAiFillingStep('name')

    const typeField = (field: 'name' | 'subject', text: string): Promise<void> =>
      new Promise((resolve) => {
        let i = 0
        const interval = setInterval(() => {
          if (cancelled) { clearInterval(interval); return }
          i++
          setValue(field, text.slice(0, i), { shouldValidate: false })
          if (i >= text.length) { clearInterval(interval); resolve() }
        }, 25)
      })

    ;(async () => {
      await typeField('name', aiDefaults.name)
      if (cancelled) return
      await new Promise(r => setTimeout(r, 300))
      setAiFillingStep('subject')
      await typeField('subject', aiDefaults.subject)
      if (cancelled) return
      await new Promise(r => setTimeout(r, 300))
      setAiFillingStep('html')
      setValue('htmlContent', aiDefaults.htmlContent, { shouldValidate: true })
      // Store AI blocks for the editor
      if (aiDefaults._blocks && Array.isArray(aiDefaults._blocks)) {
        setAiBlocks(aiDefaults._blocks)
      }
      setEditorKey(prev => prev + 1)
      await new Promise(r => setTimeout(r, 800))
      setAiFillingStep('done')
      setIsAiFilling(false)
    })()

    return () => { cancelled = true }
  }, [aiDefaults, setValue])

  // Build preview document
  const previewHtml = useMemo(() => {
    const body = htmlContent || '<div style="font-family:Arial,sans-serif;padding:48px 24px;color:#9ca3af;text-align:center;">Selecciona una plantilla para comenzar</div>'
    return `<!doctype html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><base target="_blank"/><style>body{margin:0;background:#f3f4f6;padding:16px;font-family:Arial,sans-serif;} *{box-sizing:border-box;} a{pointer-events:none!important;cursor:default!important;}</style></head><body>${body}</body></html>`
  }, [htmlContent])

  const createMutation = useMutation({
    mutationFn: async (data: CampaignFormData) => {
      const res = await fetch('/api/marketing/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'No se pudo crear la campaña')
      }
      return res.json()
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['marketing-campaigns'] })
      setCurrentCampaignId(data.id)
      setIsDirtySinceSave(false)
      setLastSavedAt(new Date())
      toast('✅ Campaña guardada. Ahora agrega destinatarios.', 'success')
      setActiveStep(2) // Jump to recipients step
    },
  })

  const updateMutation = useMutation({
    mutationFn: async (data: CampaignFormData) => {
      const id = effectiveId
      const res = await fetch(`/api/marketing/campaigns/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'No se pudo actualizar la campaña')
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['marketing-campaigns'] })
      if (effectiveId) queryClient.invalidateQueries({ queryKey: ['marketing-campaign', effectiveId] })
      setIsDirtySinceSave(false)
      setLastSavedAt(new Date())
      toast('Cambios guardados', 'success')
    },
    onError: (error: any) => {
      toast(error.message || 'Error al guardar', 'error')
    }
  })

  const onSubmit = (data: CampaignFormData) => {
    const id = effectiveId
    if (id) updateMutation.mutate(data)
    else createMutation.mutate(data)
  }

  const ensureSaved = async (): Promise<string | null> => {
    const id = effectiveId
    if (id) return id
    const data: CampaignFormData = { name, subject, htmlContent, scheduledAt: scheduledAt || '' }
    const parsed = campaignSchema.safeParse(data)
    if (!parsed.success) {
      toast('Completa nombre, asunto y contenido antes de continuar', 'warning')
      return null
    }
    const created = await createMutation.mutateAsync(parsed.data)
    return created.id
  }

  // Add recipients mutation
  const addRecipientsMutation = useMutation({
    mutationFn: async (payload: { customerIds?: string[]; emails?: string[] }) => {
      const id = effectiveId
      if (!id) throw new Error('Guarda la campaña primero')
      const res = await fetch(`/api/marketing/campaigns/${id}/recipients`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Error al agregar destinatarios')
      }
      return res.json()
    },
    onSuccess: (data) => {
      refetchCampaign()
      setSelectedCustomers([])
      setManualEmails([''])
      toast(`${data.added} destinatario(s) agregados`, 'success')
    },
    onError: (err: any) => toast(err.message, 'error'),
  })

  const handleAddRecipients = () => {
    const customerIds = selectedCustomers.length > 0 ? selectedCustomers : undefined
    const emails = manualEmails.filter(e => e.trim() && e.includes('@'))
    const validEmails = emails.length > 0 ? emails : undefined
    if (!customerIds && !validEmails) {
      toast('Selecciona al menos un cliente o agrega un email', 'warning')
      return
    }
    addRecipientsMutation.mutate({ customerIds, emails: validEmails })
  }

  // Send campaign mutation
  const sendMutation = useMutation({
    mutationFn: async () => {
      const id = effectiveId
      if (!id) throw new Error('No campaign ID')
      const res = await fetch(`/api/marketing/campaigns/${id}/send`, { method: 'POST' })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Error al enviar')
      }
      return res.json()
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['marketing-campaigns'] })
      refetchCampaign()
      if (data.failed > 0) {
        toast(`Enviada: ${data.sent} exitosos, ${data.failed} fallidos`, 'warning')
      } else {
        toast(`🎉 Campaña enviada a ${data.sent} destinatarios`, 'success')
      }
    },
    onError: (err: any) => toast(err.message, 'error'),
  })

  const sendTestMutation = useMutation({
    mutationFn: async () => {
      const id = await ensureSaved()
      if (!id) throw new Error('Primero guarda la campaña')
      const res = await fetch(`/api/marketing/campaigns/${id}/send-test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: testEmail, name: testName }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'No se pudo enviar el email de prueba')
      return data
    },
    onSuccess: () => {
      toast('Email de prueba enviado ✉️', 'success')
      setShowSendTest(false)
    },
    onError: (error: any) => toast(error.message || 'Error al enviar prueba', 'error'),
  })

  // Stepper
  const hasInfo = !!(name && subject)
  const hasDesign = !!(htmlContent && htmlContent.trim().length > 0)
  const hasSaved = !!effectiveId
  const hasRecipients = recipients.length > 0

  const steps = [
    { label: 'Info', icon: FileText, done: hasInfo },
    { label: 'Diseño', icon: Palette, done: hasDesign },
    { label: 'Destinatarios', icon: Users, done: hasRecipients },
    { label: 'Enviar', icon: Megaphone, done: campaignData?.status === 'SENT' },
  ]

  return (
    <div className="space-y-4">
      <Card className="border-0 shadow-lg shadow-slate-200/40 dark:shadow-none rounded-2xl">
        <CardHeader className="pb-3 border-b">
          <div className="flex justify-between items-start">
            <div className="space-y-0.5">
              <CardTitle className="text-base font-bold tracking-tight">
                {effectiveId ? 'Editar Campaña' : 'Nueva Campaña'}
              </CardTitle>
              <CardDescription className="text-[11px]">
                Diseña, agrega destinatarios y envía — todo desde aquí
              </CardDescription>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8">
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Clickable Step Indicator */}
          <div className="flex items-center justify-center gap-0.5 mt-4 overflow-x-auto">
            {steps.map((step, i) => {
              const Icon = step.icon
              const isClickable = i <= 1 || (i === 2 && hasSaved) || (i === 3 && hasSaved && hasRecipients)
              return (
                <div key={i} className="flex items-center">
                  <button
                    type="button"
                    disabled={!isClickable}
                    onClick={() => isClickable && setActiveStep(i)}
                    className={cn(
                      "flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all",
                      activeStep === i
                        ? "bg-blue-600 text-white shadow-sm shadow-blue-200 dark:shadow-blue-900/30"
                        : step.done
                        ? "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400"
                        : "bg-slate-50 dark:bg-slate-800 text-slate-400",
                      isClickable ? "cursor-pointer hover:scale-[1.03]" : "opacity-40 cursor-not-allowed"
                    )}>
                    {step.done && activeStep !== i
                      ? <Check className="w-3.5 h-3.5" />
                      : <Icon className="w-3.5 h-3.5" />
                    }
                    <span className="hidden sm:inline">{step.label}</span>
                  </button>
                  {i < steps.length - 1 && (
                    <div className={cn("w-8 h-px mx-0.5", step.done ? "bg-emerald-300 dark:bg-emerald-700" : "bg-slate-200 dark:bg-slate-700")} />
                  )}
                </div>
              )
            })}
          </div>
        </CardHeader>
        <CardContent className="pt-4">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            {/* AI Filling Banner */}
            {isAiFilling && (
              <div className="flex items-center gap-3 p-3 rounded-xl border-2 border-purple-300 dark:border-purple-700 bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 animate-pulse">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shrink-0">
                  <span className="text-sm">🐙</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-purple-800 dark:text-purple-300">
                    Clivi está creando tu campaña...
                  </p>
                  <p className="text-xs text-purple-600 dark:text-purple-400">
                    {aiFillingStep === 'name' && '✍️ Escribiendo nombre...'}
                    {aiFillingStep === 'subject' && '✍️ Escribiendo asunto...'}
                    {aiFillingStep === 'html' && '🎨 Generando diseño del email...'}
                    {aiFillingStep === 'done' && '✅ ¡Listo!'}
                  </p>
                </div>
                <Loader2 className="w-4 h-4 text-purple-500 animate-spin shrink-0" />
              </div>
            )}

            {/* Status bar */}
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-100 dark:border-slate-800 p-2.5 bg-slate-50/50 dark:bg-slate-800/30">
              <div className="flex items-center gap-2 text-[11px] text-muted-foreground pl-1">
                <span className={cn(
                  "w-2 h-2 rounded-full",
                  isDirtySinceSave ? "bg-amber-500 animate-pulse" : lastSavedAt ? "bg-emerald-500" : "bg-slate-300"
                )} />
                {isDirtySinceSave ? 'Cambios sin guardar' : lastSavedAt ? `Guardado ${lastSavedAt.toLocaleTimeString('es-CO')}` : 'Sin cambios'}
              </div>
              <div className="flex gap-1.5">
                <Button type="button" variant="outline" size="sm" onClick={() => setShowPreview(true)} className="text-[11px] h-8 px-3">
                  <Eye className="h-3.5 w-3.5 mr-1.5" /> Preview
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={() => setShowSendTest(true)} className="text-[11px] h-8 px-3">
                  <Send className="h-3.5 w-3.5 mr-1.5" /> Test
                </Button>
                <Button type="submit" size="sm" disabled={createMutation.isPending || updateMutation.isPending} className="text-[11px] h-8 px-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold">
                  <Save className="h-3.5 w-3.5 mr-1.5" />
                  {createMutation.isPending || updateMutation.isPending ? 'Guardando…' : effectiveId ? 'Guardar' : 'Guardar'}
                </Button>
              </div>
            </div>

            {/* ═══════ STEP 0-1: Info + Design ═══════ */}
            {activeStep <= 1 && (
              <div className="grid gap-5 lg:grid-cols-2">
                {/* Left — fields + builder */}
                <div className="space-y-5">
                  {/* Campaign info */}
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <Label htmlFor="name" className="text-xs font-bold">Nombre de la Campaña</Label>
                      <Input id="name" {...register('name')} placeholder="Ej: Promoción de Verano 2026" className="mt-1" />
                      {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name.message}</p>}
                    </div>
                    <div>
                      <Label htmlFor="subject" className="text-xs font-bold">Asunto del Email</Label>
                      <Input id="subject" {...register('subject')} placeholder="Ej: ¡Ofertas especiales!" className="mt-1" />
                      {errors.subject && <p className="text-xs text-red-500 mt-1">{errors.subject.message}</p>}
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="scheduledAt" className="text-xs font-bold">Programar Envío (Opcional)</Label>
                    <Controller
                      name="scheduledAt"
                      control={control}
                      render={({ field }) => <Input id="scheduledAt" type="datetime-local" {...field} className="mt-1 max-w-xs" />}
                    />
                    <p className="text-[10px] text-muted-foreground mt-1">Deja vacío para guardar como borrador. Usa <code className="text-blue-600">{'{{name}}'}</code> en el asunto para personalizar.</p>
                  </div>

                  {/* Email Builder */}
                  <div className="border rounded-xl p-4 bg-white dark:bg-slate-900">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
                        <MailOpen className="w-3.5 h-3.5 text-white" />
                      </div>
                      <span className="text-sm font-bold text-slate-900 dark:text-white">Editor de Email</span>
                    </div>
                    <EmailBuilder
                      key={editorKey}
                      value={htmlContent || ''}
                      initialBlocks={aiBlocks}
                      onChange={(value) => {
                        setValue('htmlContent', value, { shouldValidate: true })
                      }}
                    />
                    {errors.htmlContent && <p className="text-xs text-red-500 mt-2">{errors.htmlContent.message}</p>}
                  </div>
                </div>

                {/* Right — live preview */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-bold text-slate-900 dark:text-white">Vista previa</div>
                    <div className="flex gap-1 bg-slate-100 dark:bg-slate-800 rounded-lg p-0.5">
                      <Button type="button" size="sm" variant={previewMode === 'desktop' ? 'default' : 'ghost'} onClick={() => setPreviewMode('desktop')} className="text-xs h-7 rounded-md px-2.5">
                        <Monitor className="w-3.5 h-3.5 mr-1" /> Desktop
                      </Button>
                      <Button type="button" size="sm" variant={previewMode === 'mobile' ? 'default' : 'ghost'} onClick={() => setPreviewMode('mobile')} className="text-xs h-7 rounded-md px-2.5">
                        <Smartphone className="w-3.5 h-3.5 mr-1" /> Móvil
                      </Button>
                    </div>
                  </div>

                  <div className={cn(
                    "rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 p-3 flex justify-center transition-all sticky top-4",
                    previewMode === 'mobile' ? 'max-w-[400px] mx-auto' : ''
                  )}>
                    <div className={cn("bg-white dark:bg-slate-900 rounded-lg shadow-sm overflow-hidden w-full", previewMode === 'mobile' ? 'max-w-[360px]' : '')}>
                      <div className="px-3 py-2 border-b bg-slate-50 dark:bg-slate-800/50 space-y-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[9px] font-bold text-slate-400 uppercase w-10">De:</span>
                          <span className="text-[10px] text-slate-600 dark:text-slate-400">Tu Empresa &lt;info@tuempresa.com&gt;</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[9px] font-bold text-slate-400 uppercase w-10">Asunto:</span>
                          <span className="text-[10px] font-bold text-slate-800 dark:text-slate-200">{subject || 'Sin asunto'}</span>
                        </div>
                      </div>
                      <iframe
                        title="Vista previa campaña"
                        className="w-full bg-white"
                        style={{ height: Math.min(800, 600), border: '0' }}
                        srcDoc={previewHtml}
                      />
                    </div>
                  </div>
                  <p className="text-[10px] text-slate-400 text-center">
                    El renderizado puede variar levemente entre Gmail, Outlook y otros clientes.
                  </p>

                  {/* Next step CTA */}
                  {hasInfo && hasDesign && (
                    <Button
                      type={effectiveId ? 'button' : 'submit'}
                      onClick={effectiveId ? () => setActiveStep(2) : undefined}
                      className="w-full rounded-xl bg-blue-600 hover:bg-blue-700 h-11 text-sm font-bold"
                    >
                      {effectiveId ? (
                        <><Users className="w-4 h-4 mr-2" /> Continuar a Destinatarios</>
                      ) : (
                        <><Save className="w-4 h-4 mr-2" /> Guardar y agregar destinatarios</>
                      )}
                    </Button>
                  )}
                </div>
              </div>
            )}

            {/* ═══════ STEP 2: Recipients (inline) ═══════ */}
            {activeStep === 2 && effectiveId && (
              <div className="space-y-5">
                <div className="flex items-center gap-3">
                  <button type="button" onClick={() => setActiveStep(1)} className="text-slate-400 hover:text-slate-600 transition-colors">
                    <ArrowRight className="w-4 h-4 rotate-180" />
                  </button>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">Agregar Destinatarios</h3>
                  {recipients.length > 0 && (
                    <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400">
                      {recipients.length} agregados
                    </span>
                  )}
                </div>

                <div className="grid gap-5 lg:grid-cols-2">
                  {/* Left: Add new */}
                  <div className="space-y-4">
                    {/* Customers list */}
                    <div className="border rounded-xl p-4 bg-white dark:bg-slate-900">
                      <div className="flex items-center justify-between mb-3">
                        <Label className="text-xs font-bold">Clientes con Email</Label>
                        {filteredCustomers.length > 0 && (
                          <Button
                            type="button" variant="ghost" size="sm" className="text-xs h-7"
                            onClick={() => {
                              if (selectedCustomers.length === filteredCustomers.length) {
                                setSelectedCustomers([])
                              } else {
                                setSelectedCustomers(filteredCustomers.map((c: any) => c.id))
                              }
                            }}
                          >
                            {selectedCustomers.length === filteredCustomers.length ? 'Ninguno' : 'Todos'}
                          </Button>
                        )}
                      </div>
                      <Input
                        value={customerSearch}
                        onChange={e => setCustomerSearch(e.target.value)}
                        placeholder="Buscar cliente..."
                        className="text-xs mb-2"
                      />
                      <div className="max-h-48 overflow-y-auto space-y-0.5">
                        {filteredCustomers.length === 0 ? (
                          <p className="text-xs text-slate-400 py-4 text-center">No hay clientes con email</p>
                        ) : (
                          filteredCustomers.map((customer: any) => (
                            <label key={customer.id} className="flex items-center gap-2 p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer text-sm">
                              <Checkbox
                                checked={selectedCustomers.includes(customer.id)}
                                onCheckedChange={(checked) => {
                                  if (checked) setSelectedCustomers([...selectedCustomers, customer.id])
                                  else setSelectedCustomers(selectedCustomers.filter(id => id !== customer.id))
                                }}
                              />
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-xs truncate">{customer.name}</p>
                                <p className="text-[10px] text-slate-400 truncate">{customer.email}</p>
                              </div>
                            </label>
                          ))
                        )}
                      </div>
                    </div>

                    {/* Manual emails */}
                    <div className="border rounded-xl p-4 bg-white dark:bg-slate-900">
                      <div className="flex items-center justify-between mb-3">
                        <Label className="text-xs font-bold">Emails Manuales</Label>
                        <Button type="button" variant="ghost" size="sm" className="text-xs h-7" onClick={() => setManualEmails([...manualEmails, ''])}>
                          <Plus className="w-3 h-3 mr-1" /> Agregar
                        </Button>
                      </div>
                      <div className="space-y-1.5">
                        {manualEmails.map((email, index) => (
                          <div key={index} className="flex gap-1.5">
                            <Input
                              type="email"
                              placeholder="email@ejemplo.com"
                              value={email}
                              onChange={e => {
                                const newEmails = [...manualEmails]
                                newEmails[index] = e.target.value
                                setManualEmails(newEmails)
                              }}
                              className="text-xs"
                            />
                            {manualEmails.length > 1 && (
                              <Button type="button" variant="ghost" size="sm" className="h-9 w-9 p-0 shrink-0" onClick={() => setManualEmails(manualEmails.filter((_, i) => i !== index))}>
                                <Trash2 className="h-3 w-3 text-red-400" />
                              </Button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>

                    <Button
                      type="button"
                      onClick={handleAddRecipients}
                      disabled={addRecipientsMutation.isPending}
                      className="w-full rounded-xl bg-blue-600 hover:bg-blue-700 h-10"
                    >
                      {addRecipientsMutation.isPending ? (
                        <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Agregando...</>
                      ) : (
                        <><Plus className="w-4 h-4 mr-2" /> Agregar {selectedCustomers.length + manualEmails.filter(e => e.includes('@')).length} destinatario(s)</>
                      )}
                    </Button>
                  </div>

                  {/* Right: Current recipients */}
                  <div className="space-y-4">
                    <div className="border rounded-xl p-4 bg-white dark:bg-slate-900">
                      <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Destinatarios actuales ({recipients.length})</h4>
                      {recipients.length === 0 ? (
                        <div className="py-8 text-center">
                          <Users className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                          <p className="text-sm text-slate-400">Aún no hay destinatarios</p>
                          <p className="text-[10px] text-slate-400 mt-1">Selecciona clientes o agrega emails a la izquierda</p>
                        </div>
                      ) : (
                        <div className="max-h-64 overflow-y-auto space-y-1">
                          {recipients.map((r: any) => (
                            <div key={r.id} className="flex items-center justify-between p-2 rounded-lg bg-slate-50 dark:bg-slate-800">
                              <div className="flex items-center gap-2 min-w-0">
                                <div className={cn("w-2 h-2 rounded-full shrink-0",
                                  r.status === 'SENT' ? 'bg-emerald-500' :
                                  r.status === 'FAILED' ? 'bg-red-500' : 'bg-amber-400'
                                )} />
                                <span className="text-xs truncate">{r.email}</span>
                              </div>
                              <span className={cn("text-[10px] font-medium shrink-0",
                                r.status === 'SENT' ? 'text-emerald-600' :
                                r.status === 'FAILED' ? 'text-red-500' : 'text-slate-400'
                              )}>
                                {r.status === 'SENT' ? 'Enviado' : r.status === 'FAILED' ? 'Fallido' : 'Pendiente'}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Go to send step */}
                    {pendingCount > 0 && (
                      <Button
                        type="button"
                        onClick={() => setActiveStep(3)}
                        className="w-full rounded-xl bg-emerald-600 hover:bg-emerald-700 h-11 text-sm font-bold"
                      >
                        <Send className="w-4 h-4 mr-2" /> Listo — ir a Enviar ({pendingCount} pendientes)
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* ═══════ STEP 3: Send ═══════ */}
            {activeStep === 3 && effectiveId && (
              <div className="space-y-5">
                <div className="flex items-center gap-3">
                  <button type="button" onClick={() => setActiveStep(2)} className="text-slate-400 hover:text-slate-600 transition-colors">
                    <ArrowRight className="w-4 h-4 rotate-180" />
                  </button>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">Enviar Campaña</h3>
                </div>

                {/* Summary card */}
                <div className="border-2 rounded-2xl p-6 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/10 dark:to-indigo-900/10 border-blue-200 dark:border-blue-800">
                  <div className="text-center space-y-4">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center mx-auto">
                      <Send className="w-7 h-7 text-white" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-slate-900 dark:text-white">{name || 'Tu campaña'}</h3>
                      <p className="text-sm text-slate-500 mt-1">Asunto: {subject}</p>
                    </div>

                    {/* KPIs */}
                    <div className="grid grid-cols-3 gap-3 max-w-md mx-auto">
                      <div className="rounded-xl bg-white dark:bg-slate-800 p-3 shadow-sm">
                        <p className="text-2xl font-bold text-slate-900 dark:text-white">{recipients.length}</p>
                        <p className="text-[10px] text-slate-400 font-medium">Total</p>
                      </div>
                      <div className="rounded-xl bg-amber-50 dark:bg-amber-900/20 p-3 shadow-sm">
                        <p className="text-2xl font-bold text-amber-600">{pendingCount}</p>
                        <p className="text-[10px] text-amber-500 font-medium">Pendientes</p>
                      </div>
                      <div className="rounded-xl bg-emerald-50 dark:bg-emerald-900/20 p-3 shadow-sm">
                        <p className="text-2xl font-bold text-emerald-600">{sentCount}</p>
                        <p className="text-[10px] text-emerald-500 font-medium">Enviados</p>
                      </div>
                    </div>

                    {pendingCount > 0 ? (
                      <div className="space-y-3 pt-2">
                        <Button
                          type="button"
                          onClick={() => {
                            if (confirm(`¿Enviar la campaña "${name}" a ${pendingCount} destinatarios?`)) {
                              sendMutation.mutate()
                            }
                          }}
                          disabled={sendMutation.isPending}
                          className="rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 h-12 px-8 text-sm font-bold shadow-lg shadow-blue-200 dark:shadow-blue-900/30"
                        >
                          {sendMutation.isPending ? (
                            <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Enviando...</>
                          ) : (
                            <><Send className="w-4 h-4 mr-2" /> Enviar a {pendingCount} destinatarios</>
                          )}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setShowSendTest(true)}
                          className="rounded-xl text-xs"
                        >
                          📧 Enviar prueba primero
                        </Button>
                      </div>
                    ) : recipients.length > 0 ? (
                      <div className="flex items-center justify-center gap-2 text-emerald-600 dark:text-emerald-400">
                        <CheckCircle className="w-5 h-5" />
                        <span className="text-sm font-bold">¡Todos los emails fueron enviados!</span>
                      </div>
                    ) : (
                      <p className="text-sm text-slate-400">Agrega destinatarios primero</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Bottom actions (only in design step) */}
            {activeStep <= 1 && (
              <div className="flex justify-end gap-2 pt-2 border-t">
                <Button type="button" variant="outline" onClick={onClose} className="rounded-lg">
                  Volver
                </Button>
                <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending} className="rounded-lg bg-blue-600 hover:bg-blue-700">
                  <Save className="h-4 w-4 mr-2" />
                  {createMutation.isPending || updateMutation.isPending ? 'Guardando…' : effectiveId ? 'Guardar cambios' : 'Guardar campaña'}
                </Button>
              </div>
            )}
          </form>
        </CardContent>
      </Card>

      {/* Preview modal (full) */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Vista previa del email</DialogTitle>
            <DialogDescription>Así se verá tu email en la bandeja de entrada</DialogDescription>
          </DialogHeader>
          <div className="flex justify-center bg-slate-100 dark:bg-slate-800 p-6 rounded-xl border">
            <div className="bg-white dark:bg-slate-900 rounded-lg shadow-lg overflow-hidden w-full max-w-[640px]">
              <div className="px-4 py-2.5 border-b bg-slate-50 dark:bg-slate-800/50">
                <div className="text-[10px] text-slate-500"><strong>Asunto:</strong> {subject || 'Sin asunto'}</div>
              </div>
              <iframe
                title="Vista previa completa"
                style={{ width: '100%', height: 700, border: '0', background: '#fff' }}
                srcDoc={previewHtml}
              />
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Send test modal */}
      <Dialog open={showSendTest} onOpenChange={setShowSendTest}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Enviar email de prueba</DialogTitle>
            <DialogDescription>Envía una prueba para verificar cómo se ve tu campaña</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs font-bold">Email destino</Label>
              <Input value={testEmail} onChange={(e) => setTestEmail(e.target.value)} placeholder="tu@email.com" className="mt-1" />
            </div>
            <div>
              <Label className="text-xs font-bold">
                Nombre (para <code className="text-blue-600">{'{{name}}'}</code>)
              </Label>
              <Input value={testName} onChange={(e) => setTestName(e.target.value)} placeholder="Ej: Carlos" className="mt-1" />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setShowSendTest(false)} className="rounded-lg">
                Cancelar
              </Button>
              <Button type="button" onClick={() => sendTestMutation.mutate()} disabled={sendTestMutation.isPending} className="rounded-lg bg-blue-600 hover:bg-blue-700">
                {sendTestMutation.isPending ? 'Enviando…' : 'Enviar prueba'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
