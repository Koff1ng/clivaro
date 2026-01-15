'use client'

import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Eye, Send, Save, Users, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import CanvaEditor from '@/components/marketing/canva-editor'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
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
  onClose: () => void
  onSuccess: (createdCampaignId?: string) => void
}

export default function CampaignForm({ campaignId, onClose, onSuccess }: CampaignFormProps) {
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

  const templates = useMemo(
    () => [
      {
        id: 'promo',
        name: 'Promo (Producto + CTA)',
        description: 'Ideal para ofertas rápidas con un botón de compra.',
        html: `
<div style="font-family: Arial, sans-serif; padding: 24px;">
  <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden;">
    <div style="background: linear-gradient(135deg, #2563eb 0%, #4f46e5 100%); padding: 28px; color: #fff;">
      <div style="font-size: 12px; opacity: .9;">Oferta exclusiva</div>
      <h1 style="margin: 6px 0 0 0; font-size: 28px;">Hola {{name}}, tenemos algo para ti</h1>
      <p style="margin: 10px 0 0 0; opacity: .95;">Ahorra hoy en nuestros productos destacados.</p>
    </div>
    <div style="padding: 24px;">
      <h2 style="margin: 0 0 8px 0; font-size: 18px; color: #111827;">Producto destacado</h2>
      <div style="display: flex; gap: 16px; align-items: center; border: 1px solid #e5e7eb; border-radius: 10px; padding: 14px;">
        <div style="width: 92px; height: 92px; background: #f3f4f6; border-radius: 10px; display:flex; align-items:center; justify-content:center; color:#6b7280; font-size: 12px;">
          Imagen
        </div>
        <div style="flex: 1;">
          <div style="font-weight: 700; color: #111827;">Nombre del producto</div>
          <div style="color: #6b7280; font-size: 13px; margin-top: 4px;">Descripción breve del beneficio principal.</div>
          <div style="margin-top: 10px; display:flex; gap: 10px; align-items: baseline;">
            <span style="font-size: 20px; font-weight: 700; color:#111827;">$99.900</span>
            <span style="font-size: 13px; color:#6b7280; text-decoration: line-through;">$129.900</span>
          </div>
        </div>
      </div>

      <div style="margin-top: 18px; text-align: center;">
        <a href="https://tusitio.com" style="display:inline-block; background:#2563eb; color:#fff; text-decoration:none; padding: 12px 18px; border-radius: 10px; font-weight: 700;">
          Ver oferta
        </a>
        <div style="margin-top: 10px; font-size: 12px; color:#6b7280;">
          Si no quieres recibir estos correos, ignora este mensaje.
        </div>
      </div>
    </div>
  </div>
</div>
`.trim(),
      },
      {
        id: 'newsletter',
        name: 'Newsletter (Secciones)',
        description: 'Para novedades semanales o contenido educativo.',
        html: `
<div style="font-family: Arial, sans-serif; padding: 24px;">
  <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden;">
    <div style="padding: 22px 24px; border-bottom: 1px solid #e5e7eb;">
      <div style="font-size: 12px; color: #6b7280;">Newsletter</div>
      <h1 style="margin: 6px 0 0 0; font-size: 24px; color: #111827;">Novedades de la semana</h1>
      <p style="margin: 10px 0 0 0; color:#374151;">Hola {{name}}, aquí tienes lo más importante.</p>
    </div>
    <div style="padding: 24px; display: grid; gap: 14px;">
      <div style="border: 1px solid #e5e7eb; border-radius: 12px; padding: 14px;">
        <div style="font-weight: 700; color:#111827;">1) Nuevo producto</div>
        <div style="margin-top: 6px; color:#6b7280; font-size: 14px;">Descripción breve y por qué importa.</div>
      </div>
      <div style="border: 1px solid #e5e7eb; border-radius: 12px; padding: 14px;">
        <div style="font-weight: 700; color:#111827;">2) Tips de uso</div>
        <div style="margin-top: 6px; color:#6b7280; font-size: 14px;">Un consejo práctico para tus clientes.</div>
      </div>
      <div style="border: 1px solid #e5e7eb; border-radius: 12px; padding: 14px;">
        <div style="font-weight: 700; color:#111827;">3) Oferta de la semana</div>
        <div style="margin-top: 6px; color:#6b7280; font-size: 14px;">Incluye el descuento y fecha de vigencia.</div>
      </div>
      <div style="text-align:center; padding-top: 6px;">
        <a href="https://tusitio.com" style="display:inline-block; background:#111827; color:#fff; text-decoration:none; padding: 12px 18px; border-radius: 10px; font-weight: 700;">
          Ver más
        </a>
      </div>
    </div>
    <div style="padding: 16px 24px; border-top: 1px solid #e5e7eb; font-size: 12px; color:#6b7280; text-align:center;">
      Enviado por tu empresa • {{email}}
    </div>
  </div>
</div>
`.trim(),
      },
    ],
    []
  )

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
    // Mark as dirty on meaningful changes
    setIsDirtySinceSave(true)
  }, [htmlContent, name, subject, scheduledAt])

  // Build a safe-ish preview document
  const previewHtml = useMemo(() => {
    const body = htmlContent || '<div style="font-family: Arial, sans-serif; padding: 24px; color: #111827;">Empieza creando tu email…</div>'
    return `<!doctype html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><style>body{margin:0;background:#f3f4f6;} .wrap{max-width:600px;margin:0 auto;background:#fff}</style></head><body><div class="wrap">${body}</div></body></html>`
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

  return (
    <div className="container mx-auto p-6">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>{(currentCampaignId || campaignId) ? 'Editar Campaña' : 'Nueva Campaña'}</CardTitle>
              <CardDescription>
                Diseña emails profesionales con editor visual, vista previa y envío de prueba
              </CardDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {/* Top actions */}
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 bg-muted/30">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                {isDirtySinceSave ? 'Cambios sin guardar' : lastSavedAt ? `Guardado ${lastSavedAt.toLocaleTimeString('es-CO')}` : '—'}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" onClick={() => setShowPreview(true)}>
                  <Eye className="h-4 w-4 mr-2" />
                  Vista previa
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={async () => {
                    const id = await ensureSaved()
                    if (id) setShowRecipients(true)
                  }}
                >
                  <Users className="h-4 w-4 mr-2" />
                  Destinatarios
                </Button>
                <Button type="button" variant="outline" onClick={() => setShowSendTest(true)}>
                  <Send className="h-4 w-4 mr-2" />
                  Enviar prueba
                </Button>
                <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                  <Save className="h-4 w-4 mr-2" />
                  {createMutation.isPending || updateMutation.isPending ? 'Guardando…' : 'Guardar'}
                </Button>
              </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              {/* Left: fields + editor */}
              <div className="space-y-6">
                <div>
                  <Label htmlFor="name">Nombre de la Campaña</Label>
                  <Input id="name" {...register('name')} placeholder="Ej: Promoción de Verano 2026" />
                  {errors.name && <p className="text-sm text-red-500 mt-1">{errors.name.message}</p>}
                </div>

                <div>
                  <Label htmlFor="subject">Asunto del Email</Label>
                  <Input id="subject" {...register('subject')} placeholder="Ej: ¡Ofertas especiales para ti!" />
                  <p className="text-xs text-gray-500 mt-1">Tip: usa personalización como <code>{'{{name}}'}</code></p>
                  {errors.subject && <p className="text-sm text-red-500 mt-1">{errors.subject.message}</p>}
                </div>

                <div>
                  <Label htmlFor="scheduledAt">Programar Envío (Opcional)</Label>
                  <Controller
                    name="scheduledAt"
                    control={control}
                    render={({ field }) => <Input id="scheduledAt" type="datetime-local" {...field} />}
                  />
                  <p className="text-xs text-gray-500 mt-1">Deja vacío para guardar como borrador</p>
                </div>

                <div>
                  {/* Templates (media priority) */}
                  <Card className="mb-4">
                    <CardHeader>
                      <CardTitle className="text-sm">Plantillas rápidas</CardTitle>
                      <CardDescription>
                        Elige una base profesional. Esto <strong>reemplaza</strong> el contenido actual.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="grid gap-2 sm:grid-cols-2">
                      {templates.map((t) => (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => {
                            const hasContent = (htmlContent || '').trim().length > 0
                            if (hasContent) {
                              const ok = confirm('Esto reemplazará el contenido actual del email. ¿Continuar?')
                              if (!ok) return
                            }
                            setValue('htmlContent', t.html, { shouldValidate: true })
                            setEditorKey(Date.now())
                            toast(`Plantilla aplicada: ${t.name}`, 'success')
                          }}
                          className="text-left rounded-lg border p-3 hover:bg-accent/40 transition-colors"
                        >
                          <div className="font-medium text-sm">{t.name}</div>
                          <div className="text-xs text-muted-foreground mt-1">{t.description}</div>
                        </button>
                      ))}
                    </CardContent>
                  </Card>

                  <CanvaEditor
                    key={editorKey}
                    value={htmlContent || ''}
                    onChange={(value) => {
                      setValue('htmlContent', value, { shouldValidate: true })
                    }}
                  />
                  {errors.htmlContent && <p className="text-sm text-red-500 mt-1">{errors.htmlContent.message}</p>}
                </div>
              </div>

              {/* Right: live preview */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="font-medium">Vista previa</div>
                  <div className="flex gap-2">
                    <Button type="button" size="sm" variant={previewMode === 'desktop' ? 'default' : 'outline'} onClick={() => setPreviewMode('desktop')}>
                      Desktop
                    </Button>
                    <Button type="button" size="sm" variant={previewMode === 'mobile' ? 'default' : 'outline'} onClick={() => setPreviewMode('mobile')}>
                      Móvil
                    </Button>
                  </div>
                </div>
                <div className="rounded-lg border bg-white p-2 flex justify-center">
                  <iframe
                    title="Vista previa campaña"
                    className="bg-white"
                    style={{
                      width: previewMode === 'mobile' ? 360 : 620,
                      height: 720,
                      border: '0',
                    }}
                    srcDoc={previewHtml}
                  />
                </div>
                <p className="text-xs text-gray-500">
                  Esto renderiza el HTML real. Las apps de correo pueden variar un poco (Gmail/Outlook).
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={onClose}>
                Volver
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Preview modal (full) */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Vista previa del email</DialogTitle>
          </DialogHeader>
          <div className="flex justify-center bg-gray-50 p-4 rounded-lg border">
            <iframe
              title="Vista previa completa"
              style={{ width: 700, height: 800, border: '0', background: '#fff' }}
              srcDoc={previewHtml}
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* Send test modal */}
      <Dialog open={showSendTest} onOpenChange={setShowSendTest}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Enviar email de prueba</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Email destino</Label>
              <Input value={testEmail} onChange={(e) => setTestEmail(e.target.value)} placeholder="tu@email.com" />
            </div>
            <div>
              <Label>
                Nombre (para <code>{'{{name}}'}</code>)
              </Label>
              <Input value={testName} onChange={(e) => setTestName(e.target.value)} placeholder="Ej: Carlos" />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setShowSendTest(false)}>
                Cancelar
              </Button>
              <Button type="button" onClick={() => sendTestMutation.mutate()} disabled={sendTestMutation.isPending}>
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

