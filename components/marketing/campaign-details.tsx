'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Send, Edit, Users, Mail, CheckCircle, XCircle, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatDate, formatDateTime } from '@/lib/utils'
import { useToast } from '@/components/ui/toast'
import AddRecipientsDialog from '@/components/marketing/add-recipients-dialog'

interface CampaignDetailsProps {
  campaignId: string
  onBack: () => void
  onEdit: (id: string) => void
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
      const res = await fetch(`/api/marketing/campaigns/${campaignId}/send`, {
        method: 'POST',
      })
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
        toast(`Campaña enviada exitosamente a ${data.sent} destinatarios`, 'success')
      }
    },
    onError: (error: any) => {
      toast(`Error: ${error.message}`, 'error')
    },
  })

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PENDING':
        return 'bg-gray-500'
      case 'SENT':
        return 'bg-green-500'
      case 'FAILED':
        return 'bg-red-500'
      case 'BOUNCED':
        return 'bg-orange-500'
      default:
        return 'bg-gray-500'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'SENT':
        return <CheckCircle className="h-4 w-4" />
      case 'FAILED':
      case 'BOUNCED':
        return <XCircle className="h-4 w-4" />
      default:
        return <Clock className="h-4 w-4" />
    }
  }

  if (isLoading) {
    return <div className="container mx-auto p-6">Cargando...</div>
  }

  if (!campaign) {
    return <div className="container mx-auto p-6">Campaña no encontrada</div>
  }

  const pendingCount = campaign.recipients?.filter((r: any) => r.status === 'PENDING').length || 0
  const sentCount = campaign.recipients?.filter((r: any) => r.status === 'SENT').length || 0
  const failedCount = campaign.recipients?.filter((r: any) => r.status === 'FAILED').length || 0
  const totalRecipients = campaign.recipients?.length || 0

  return (
    <div className="container mx-auto p-6">
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Volver
        </Button>
        <div>
          <h1 className="text-3xl font-bold">{campaign.name}</h1>
          <p className="text-gray-600">{campaign.subject}</p>
        </div>
      </div>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle>Información de la Campaña</CardTitle>
              {campaign.status === 'DRAFT' && (
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => onEdit(campaignId)}>
                    <Edit className="h-4 w-4 mr-2" />
                    Editar
                  </Button>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-sm text-gray-500">Estado</span>
                <p>
                  <Badge className="bg-blue-500">{campaign.status}</Badge>
                </p>
              </div>
              <div>
                <span className="text-sm text-gray-500">Creada</span>
                <p className="font-medium">{formatDateTime(campaign.createdAt)}</p>
              </div>
              {campaign.scheduledAt && (
                <div>
                  <span className="text-sm text-gray-500">Programada para</span>
                  <p className="font-medium">{formatDateTime(campaign.scheduledAt)}</p>
                </div>
              )}
              {campaign.sentAt && (
                <div>
                  <span className="text-sm text-gray-500">Enviada</span>
                  <p className="font-medium">{formatDateTime(campaign.sentAt)}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle>Destinatarios</CardTitle>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setShowAddRecipients(true)}
                >
                  <Users className="h-4 w-4 mr-2" />
                  Agregar Destinatarios
                </Button>
                {pendingCount > 0 && campaign.status !== 'SENDING' && (
                  <Button
                    onClick={() => {
                      if (confirm(`¿Enviar campaña a ${pendingCount} destinatarios pendientes?`)) {
                        sendMutation.mutate()
                      }
                    }}
                    disabled={sendMutation.isPending}
                  >
                    <Send className="h-4 w-4 mr-2" />
                    {sendMutation.isPending ? 'Enviando...' : `Enviar (${pendingCount})`}
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-4 gap-4 mb-4">
              <div className="text-center p-4 bg-gray-50 rounded">
                <p className="text-2xl font-bold">{totalRecipients}</p>
                <p className="text-sm text-gray-500">Total</p>
              </div>
              <div className="text-center p-4 bg-yellow-50 rounded">
                <p className="text-2xl font-bold">{pendingCount}</p>
                <p className="text-sm text-gray-500">Pendientes</p>
              </div>
              <div className="text-center p-4 bg-green-50 rounded">
                <p className="text-2xl font-bold">{sentCount}</p>
                <p className="text-sm text-gray-500">Enviados</p>
              </div>
              <div className="text-center p-4 bg-red-50 rounded">
                <p className="text-2xl font-bold">{failedCount}</p>
                <p className="text-sm text-gray-500">Fallidos</p>
              </div>
            </div>

            <div className="space-y-2 max-h-96 overflow-y-auto">
              {campaign.recipients?.map((recipient: any) => (
                <div
                  key={recipient.id}
                  className="flex items-center justify-between p-3 border rounded"
                >
                  <div className="flex items-center gap-3">
                    <Mail className="h-4 w-4 text-gray-400" />
                    <div>
                      <p className="font-medium">{recipient.email}</p>
                      {recipient.customer?.name && (
                        <p className="text-sm text-gray-500">{recipient.customer.name}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={getStatusColor(recipient.status)}>
                      <span className="flex items-center gap-1">
                        {getStatusIcon(recipient.status)}
                        {recipient.status}
                      </span>
                    </Badge>
                    {recipient.sentAt && (
                      <span className="text-xs text-gray-500">
                        {formatDateTime(recipient.sentAt)}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Vista Previa del Email</CardTitle>
          </CardHeader>
          <CardContent>
            <div
              className="border rounded-lg p-4 bg-white"
              dangerouslySetInnerHTML={{ __html: campaign.htmlContent }}
            />
          </CardContent>
        </Card>
      </div>

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

