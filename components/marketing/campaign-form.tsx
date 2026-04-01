'use client'

import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Eye, Send, Save, Users, X, Check, FileText, Palette, Megaphone, Monitor, Smartphone, MailOpen, Sparkles, Loader2, Wand2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import EmailBuilder from '@/components/marketing/email-builder'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { useToast } from '@/components/ui/toast'
import AddRecipientsDialog from '@/components/marketing/add-recipients-dialog'
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
  aiDefaults?: { name: string; subject: string; htmlContent: string }
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
  const [showRecipients, setShowRecipients] = useState(false)
  const [showSendTest, setShowSendTest] = useState(false)
  const [testEmail, setTestEmail] = useState<string>(((session?.user as any)?.email as string) || '')
  const [testName, setTestName] = useState<string>(((session?.user as any)?.name as string) || '')
  const [isDirtySinceSave, setIsDirtySinceSave] = useState(false)
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null)
  const [editorKey, setEditorKey] = useState(0)
  const [aiGeneratePrompt, setAiGeneratePrompt] = useState('')
  const [isAiGenerating, setIsAiGenerating] = useState(false)

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
          if (i >= text.length) {
            clearInterval(interval)
            resolve()
          }
        }, 25) // 25ms per character = fast but visible
      })

    ;(async () => {
      // Step 1: Type name
      await typeField('name', aiDefaults.name)
      if (cancelled) return

      // Brief pause between fields
      await new Promise(r => setTimeout(r, 300))

      // Step 2: Type subject
      setAiFillingStep('subject')
      await typeField('subject', aiDefaults.subject)
      if (cancelled) return

      await new Promise(r => setTimeout(r, 300))

      // Step 3: Fade in HTML content
      setAiFillingStep('html')
      setValue('htmlContent', aiDefaults.htmlContent, { shouldValidate: true })
      setEditorKey(prev => prev + 1)

      await new Promise(r => setTimeout(r, 800))
      setAiFillingStep('done')
      setIsAiFilling(false)
    })()

    return () => { cancelled = true }
  }, [aiDefaults, setValue])

  // AI inline generate
  const handleAiGenerate = async () => {
    if (!aiGeneratePrompt.trim()) return
    setIsAiGenerating(true)
    try {
      const res = await fetch('/api/ai/marketing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'generate-html', type: 'promo', details: aiGeneratePrompt }),
      })
      if (!res.ok) throw new Error('Error de IA')
      const data = await res.json()
      setValue('htmlContent', data.html, { shouldValidate: true })
      setEditorKey(prev => prev + 1)
      setAiGeneratePrompt('')
      toast('HTML generado con IA ✨', 'success')
    } catch {
      toast('Error al generar con IA', 'error')
    } finally {
      setIsAiGenerating(false)
    }
  }

  // Build preview document
  const previewHtml = useMemo(() => {
    const body = htmlContent || '<div style="font-family:Arial,sans-serif;padding:48px 24px;color:#9ca3af;text-align:center;">Selecciona una plantilla para comenzar</div>'
    return `<!doctype html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><style>body{margin:0;background:#f3f4f6;padding:16px;font-family:Arial,sans-serif;} *{box-sizing:border-box;}</style></head><body>${body}</body></html>`
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
      toast('Campaña guardada como borrador', 'success')
      onSuccess(data.id)
    },
  })

  const updateMutation = useMutation({
    mutationFn: async (data: CampaignFormData) => {
      const id = currentCampaignId || campaignId
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
      const id = currentCampaignId || campaignId
      if (id) queryClient.invalidateQueries({ queryKey: ['marketing-campaign', id] })
      setIsDirtySinceSave(false)
      setLastSavedAt(new Date())
      toast('Cambios guardados', 'success')
      onSuccess()
    },
    onError: (error: any) => {
      toast(error.message || 'Error al guardar', 'error')
    }
  })

  const onSubmit = (data: CampaignFormData) => {
    const id = currentCampaignId || campaignId
    if (id) updateMutation.mutate(data)
    else createMutation.mutate(data)
  }

  const ensureSaved = async (): Promise<string | null> => {
    const id = currentCampaignId || campaignId
    if (id) return id
    const data: CampaignFormData = {
      name,
      subject,
      htmlContent,
      scheduledAt: scheduledAt || '',
    }
    const parsed = campaignSchema.safeParse(data)
    if (!parsed.success) {
      toast('Completa nombre, asunto y contenido antes de continuar', 'warning')
      return null
    }
    const created = await createMutation.mutateAsync(parsed.data)
    return created.id
  }

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
      toast('Email de prueba enviado', 'success')
      setShowSendTest(false)
    },
    onError: (error: any) => toast(error.message || 'Error al enviar prueba', 'error'),
  })

  // Stepper
  const hasInfo = !!(name && subject)
  const hasDesign = !!(htmlContent && htmlContent.trim().length > 0)
  const hasSaved = !!(currentCampaignId || campaignId)

  const steps = [
    { label: 'Info', icon: FileText, done: hasInfo },
    { label: 'Diseño', icon: Palette, done: hasDesign },
    { label: 'Destinatarios', icon: Users, done: false },
    { label: 'Enviar', icon: Megaphone, done: false },
  ]

  return (
    <div className="container mx-auto p-4 sm:p-6 max-w-7xl">
      <Card className="border-0 shadow-xl shadow-slate-200/50 dark:shadow-none">
        <CardHeader className="pb-4 border-b">
          <div className="flex justify-between items-start">
            <div className="space-y-1">
              <CardTitle className="text-xl font-black tracking-tight">
                {(currentCampaignId || campaignId) ? 'Editar Campaña' : 'Nueva Campaña'}
              </CardTitle>
              <CardDescription>
                Diseña emails profesionales con plantillas, vista previa y envío de prueba
              </CardDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={onClose} className="rounded-full w-8 h-8 p-0">
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Step Indicator */}
          <div className="flex items-center justify-center gap-1 mt-4 overflow-x-auto">
            {steps.map((step, i) => {
              const Icon = step.icon
              return (
                <div key={i} className="flex items-center">
                  <div className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all",
                    step.done
                      ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-500"
                  )}>
                    {step.done
                      ? <Check className="w-3.5 h-3.5" />
                      : <Icon className="w-3.5 h-3.5" />
                    }
                    <span className="hidden sm:inline">{step.label}</span>
                  </div>
                  {i < steps.length - 1 && (
                    <div className={cn("w-6 h-px mx-1", step.done ? "bg-emerald-300" : "bg-slate-200 dark:bg-slate-700")} />
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

            {/* Top actions bar */}
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border p-3 bg-slate-50/50 dark:bg-slate-800/30">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className={cn(
                  "w-2 h-2 rounded-full",
                  isDirtySinceSave ? "bg-amber-500 animate-pulse" : lastSavedAt ? "bg-emerald-500" : "bg-slate-300"
                )} />
                {isDirtySinceSave ? 'Cambios sin guardar' : lastSavedAt ? `Guardado ${lastSavedAt.toLocaleTimeString('es-CO')}` : 'Sin cambios'}
              </div>
              <div className="flex flex-wrap gap-1.5">
                <Button type="button" variant="outline" size="sm" onClick={() => setShowPreview(true)} className="text-xs rounded-lg h-8">
                  <Eye className="h-3.5 w-3.5 mr-1.5" /> Vista previa
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={async () => { const id = await ensureSaved(); if (id) setShowRecipients(true) }} className="text-xs rounded-lg h-8">
                  <Users className="h-3.5 w-3.5 mr-1.5" /> Destinatarios
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={() => setShowSendTest(true)} className="text-xs rounded-lg h-8">
                  <Send className="h-3.5 w-3.5 mr-1.5" /> Prueba
                </Button>
                <Button type="submit" size="sm" disabled={createMutation.isPending || updateMutation.isPending} className="text-xs rounded-lg h-8 bg-blue-600 hover:bg-blue-700">
                  <Save className="h-3.5 w-3.5 mr-1.5" />
                  {createMutation.isPending || updateMutation.isPending ? 'Guardando…' : 'Guardar'}
                </Button>
              </div>
            </div>

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
                  {/* AI inline generate */}
                  <div className="flex gap-1.5 mb-3 p-2 rounded-lg bg-purple-50/80 dark:bg-purple-900/10 border border-purple-200 dark:border-purple-800">
                    <input
                      value={aiGeneratePrompt}
                      onChange={(e) => setAiGeneratePrompt(e.target.value)}
                      placeholder='Ej: "Email de bienvenida con descuento del 20%"'
                      className="flex-1 bg-transparent border-0 text-xs text-slate-700 dark:text-slate-300 placeholder:text-purple-400/60 focus:outline-none"
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAiGenerate() } }}
                    />
                    <Button
                      type="button"
                      size="sm"
                      onClick={handleAiGenerate}
                      disabled={isAiGenerating || !aiGeneratePrompt.trim()}
                      className="h-6 px-2.5 text-[10px] rounded-md bg-purple-600 hover:bg-purple-700 text-white"
                    >
                      {isAiGenerating ? <Loader2 className="w-3 h-3 animate-spin" /> : <><Sparkles className="w-3 h-3 mr-1" /> Generar</>}
                    </Button>
                  </div>
                  <EmailBuilder
                    key={editorKey}
                    value={htmlContent || ''}
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
                  "rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 p-3 flex justify-center transition-all",
                  previewMode === 'mobile' ? 'max-w-[400px] mx-auto' : ''
                )}>
                  {/* Email client chrome */}
                  <div className={cn("bg-white dark:bg-slate-900 rounded-lg shadow-sm overflow-hidden w-full", previewMode === 'mobile' ? 'max-w-[360px]' : '')}>
                    {/* Fake email header */}
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
                    {/* Email body */}
                    <iframe
                      title="Vista previa campaña"
                      className="w-full bg-white"
                      style={{
                        height: Math.min(800, 600),
                        border: '0',
                      }}
                      srcDoc={previewHtml}
                    />
                  </div>
                </div>
                <p className="text-[10px] text-slate-400 text-center">
                  El renderizado puede variar levemente entre Gmail, Outlook y otros clientes.
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t">
              <Button type="button" variant="outline" onClick={onClose} className="rounded-lg">
                Volver
              </Button>
              <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending} className="rounded-lg bg-blue-600 hover:bg-blue-700">
                <Save className="h-4 w-4 mr-2" />
                {createMutation.isPending || updateMutation.isPending ? 'Guardando…' : 'Guardar campaña'}
              </Button>
            </div>
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

      {/* Recipients modal */}
      {showRecipients && (currentCampaignId || campaignId) && (
        <AddRecipientsDialog
          campaignId={(currentCampaignId || campaignId)!}
          onClose={() => setShowRecipients(false)}
          onSuccess={() => setShowRecipients(false)}
        />
      )}
    </div>
  )
}
