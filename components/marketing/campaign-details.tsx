'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Send, Edit, Users, Mail, CheckCircle, XCircle, Clock, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatDate, formatDateTime } from '@/lib/utils'
import { cn } from '@/lib/utils'
import { useToast } from '@/components/ui/toast'
import AddRecipientsDialog from '@/components/marketing/add-recipients-dialog'

interface CampaignDetailsProps {
  campaignId: string
  onBack: () => void
  onEdit: (id: string) => void
}

const STATUS_MAP: Record<string, { label: string; color: string; icon: any }> = {
  PENDING: { label: 'Pendiente', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400', icon: Clock },
  SENT: { label: 'Enviado', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400', icon: CheckCircle },
  FAILED: { label: 'Fallido', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400', icon: XCircle },
  BOUNCED: { label: 'Rebotado', color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400', icon: XCircle },
}

const CAMPAIGN_STATUS_MAP: Record<string, { label: string; color: string }> = {
  DRAFT: { label: 'Borrador', color: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300' },
  SCHEDULED: { label: 'Programada', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  SENDING: { label: 'Enviando', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
  SENT: { label: 'Enviada', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' },
  CANCELLED: { label: 'Cancelada', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
}

export default function CampaignDetails({ campaignId, onBack, onEdit }: CampaignDetailsProps) {
  const { toast } = useToast()
  const [showAddRecipients, setShowAddRecipients] = useState(false)
  const queryClient = useQueryClient()

  const { data: campaign, isLoading } = useQuery({
    queryKey: ['marketing-campaign', campaignId],
    queryFn: async () => {
      const res = await fetch(`/api/marketing/campaigns/${campaignId}`)
      if (!res.ok) throw new Error('Failed to fetch campaign')
      return res.json()
    },
  })

  const sendMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/marketing/campaigns/${campaignId}/send`, { method: 'POST' })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to send campaign')
      }
      return res.json()
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['marketing-campaign', campaignId] })
      queryClient.invalidateQueries({ queryKey: ['marketing-campaigns'] })
      if (data.failed > 0) {
        toast(`Campaña enviada: ${data.sent} exitosos, ${data.failed} fallidos`, 'warning')
      } else {
        toast(`🎉 Campaña enviada a ${data.sent} destinatarios`, 'success')
      }
    },
    onError: (error: any) => toast(`Error: ${error.message}`, 'error'),
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
      </div>
    )
  }

  if (!campaign) {
    return <div className="text-center py-20 text-slate-500">Campaña no encontrada</div>
  }

  const pendingCount = campaign.recipients?.filter((r: any) => r.status === 'PENDING').length || 0
  const sentCount = campaign.recipients?.filter((r: any) => r.status === 'SENT').length || 0
  const failedCount = campaign.recipients?.filter((r: any) => r.status === 'FAILED').length || 0
  const totalRecipients = campaign.recipients?.length || 0
  const progress = totalRecipients > 0 ? (sentCount / totalRecipients) * 100 : 0

  const campaignStatus = CAMPAIGN_STATUS_MAP[campaign.status] || { label: campaign.status, color: 'bg-slate-100 text-slate-700' }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={onBack} className="rounded-lg">
          <ArrowLeft className="h-4 w-4 mr-2" /> Volver
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-slate-900 dark:text-white truncate">{campaign.name}</h1>
            <Badge className={cn("text-[10px] font-semibold shrink-0", campaignStatus.color)}>
              {campaignStatus.label}
            </Badge>
          </div>
          <p className="text-sm text-slate-500 truncate">{campaign.subject}</p>
        </div>
        {campaign.status === 'DRAFT' && (
          <Button variant="outline" onClick={() => onEdit(campaignId)} className="rounded-lg shrink-0">
            <Edit className="h-4 w-4 mr-1.5" /> Editar
          </Button>
        )}
      </div>

      {/* Info + KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-slate-100 dark:border-slate-800">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center shrink-0">
              <Mail className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">{totalRecipients}</p>
              <p className="text-xs text-slate-500 font-medium">Total</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-slate-100 dark:border-slate-800">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center shrink-0">
              <Clock className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">{pendingCount}</p>
              <p className="text-xs text-slate-500 font-medium">Pendientes</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-slate-100 dark:border-slate-800">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center shrink-0">
              <CheckCircle className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">{sentCount}</p>
              <p className="text-xs text-slate-500 font-medium">Enviados</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-slate-100 dark:border-slate-800">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-50 dark:bg-red-900/20 flex items-center justify-center shrink-0">
              <XCircle className="w-5 h-5 text-red-500" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">{failedCount}</p>
              <p className="text-xs text-slate-500 font-medium">Fallidos</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Progress bar */}
      {totalRecipients > 0 && (
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-slate-400">
            <span>Progreso de envío</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
            <div
              className={cn("h-full rounded-full transition-all duration-500", progress === 100 ? 'bg-emerald-500' : 'bg-blue-500')}
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Info card */}
      <Card className="border-slate-100 dark:border-slate-800">
        <CardContent className="p-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-xs text-slate-400 font-medium">Creada</span>
              <p className="font-medium text-slate-900 dark:text-white">{formatDateTime(campaign.createdAt)}</p>
            </div>
            {campaign.scheduledAt && (
              <div>
                <span className="text-xs text-slate-400 font-medium">Programada</span>
                <p className="font-medium text-slate-900 dark:text-white">{formatDateTime(campaign.scheduledAt)}</p>
              </div>
            )}
            {campaign.sentAt && (
              <div>
                <span className="text-xs text-slate-400 font-medium">Enviada</span>
                <p className="font-medium text-slate-900 dark:text-white">{formatDateTime(campaign.sentAt)}</p>
              </div>
            )}
            {campaign.createdBy?.name && (
              <div>
                <span className="text-xs text-slate-400 font-medium">Creada por</span>
                <p className="font-medium text-slate-900 dark:text-white">{campaign.createdBy.name}</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Recipients */}
      <Card className="border-slate-100 dark:border-slate-800">
        <CardHeader className="pb-3">
          <div className="flex justify-between items-center">
            <CardTitle className="text-base">Destinatarios</CardTitle>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowAddRecipients(true)} className="rounded-lg text-xs h-8">
                <Users className="h-3.5 w-3.5 mr-1.5" /> Agregar
              </Button>
              {pendingCount > 0 && campaign.status !== 'SENDING' && (
                <Button
                  size="sm"
                  onClick={() => {
                    if (confirm(`¿Enviar campaña a ${pendingCount} destinatarios pendientes?`)) {
                      sendMutation.mutate()
                    }
                  }}
                  disabled={sendMutation.isPending}
                  className="rounded-lg text-xs h-8 bg-blue-600 hover:bg-blue-700"
                >
                  <Send className="h-3.5 w-3.5 mr-1.5" />
                  {sendMutation.isPending ? 'Enviando...' : `Enviar (${pendingCount})`}
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {totalRecipients === 0 ? (
            <div className="py-8 text-center">
              <Users className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
              <p className="text-sm text-slate-400">No hay destinatarios aún</p>
            </div>
          ) : (
            <div className="space-y-1 max-h-80 overflow-y-auto">
              {campaign.recipients?.map((recipient: any) => {
                const status = STATUS_MAP[recipient.status] || STATUS_MAP.PENDING
                const StatusIcon = status.icon
                return (
                  <div key={recipient.id} className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Mail className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-900 dark:text-white truncate">{recipient.email}</p>
                        {recipient.customer?.name && (
                          <p className="text-[10px] text-slate-400 truncate">{recipient.customer.name}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge className={cn("text-[10px] font-medium", status.color)}>
                        <StatusIcon className="w-3 h-3 mr-1" />
                        {status.label}
                      </Badge>
                      {recipient.sentAt && (
                        <span className="text-[10px] text-slate-400 hidden sm:inline">
                          {formatDateTime(recipient.sentAt)}
                        </span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Email Preview */}
      <Card className="border-slate-100 dark:border-slate-800">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Vista Previa del Email</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 p-3">
            <div className="bg-white dark:bg-slate-900 rounded-lg shadow-sm overflow-hidden max-w-[640px] mx-auto">
              <div className="px-3 py-2 border-b bg-slate-50 dark:bg-slate-800/50">
                <div className="text-[10px] text-slate-500"><strong>Asunto:</strong> {campaign.subject}</div>
              </div>
              <iframe
                title="Vista previa"
                style={{ width: '100%', height: 500, border: '0', background: '#fff' }}
                srcDoc={`<!doctype html><html><head><meta charset="utf-8"/><style>body{margin:0;padding:16px;font-family:Arial,sans-serif;background:#f3f4f6;}</style></head><body>${campaign.htmlContent || ''}</body></html>`}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {showAddRecipients && (
        <AddRecipientsDialog
          campaignId={campaignId}
          onClose={() => setShowAddRecipients(false)}
          onSuccess={() => {
            setShowAddRecipients(false)
            queryClient.invalidateQueries({ queryKey: ['marketing-campaign', campaignId] })
          }}
        />
      )}
    </div>
  )
}
