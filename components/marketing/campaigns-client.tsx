'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Send, Edit, Trash2, Eye, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatDate, formatDateTime } from '@/lib/utils'
import CampaignForm from '@/components/marketing/campaign-form'
import CampaignDetails from '@/components/marketing/campaign-details'

export default function CampaignsClient() {
  const [showForm, setShowForm] = useState(false)
  const [selectedCampaign, setSelectedCampaign] = useState<string | null>(null)
  const [editingCampaignId, setEditingCampaignId] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<string>('')

  const queryClient = useQueryClient()

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
      const res = await fetch(`/api/marketing/campaigns/${id}`, {
        method: 'DELETE',
      })
      if (!res.ok) throw new Error('Failed to delete campaign')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['marketing-campaigns'] })
    },
  })

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'DRAFT':
        return 'bg-gray-500'
      case 'SCHEDULED':
        return 'bg-blue-500'
      case 'SENDING':
        return 'bg-yellow-500'
      case 'SENT':
        return 'bg-green-500'
      case 'CANCELLED':
        return 'bg-red-500'
      default:
        return 'bg-gray-500'
    }
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'DRAFT':
        return 'Borrador'
      case 'SCHEDULED':
        return 'Programada'
      case 'SENDING':
        return 'Enviando'
      case 'SENT':
        return 'Enviada'
      case 'CANCELLED':
        return 'Cancelada'
      default:
        return status
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
        onClose={() => {
          setShowForm(false)
          setEditingCampaignId(null)
        }}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['marketing-campaigns'] })
        }}
      />
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Campañas de Marketing</h1>
          <p className="text-gray-600 mt-1">Gestiona y envía campañas publicitarias a tus clientes</p>
        </div>
        <Button onClick={() => setShowForm(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Nueva Campaña
        </Button>
      </div>

      <div className="flex gap-2">
        <Button
          variant={statusFilter === '' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setStatusFilter('')}
        >
          Todas
        </Button>
        <Button
          variant={statusFilter === 'DRAFT' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setStatusFilter('DRAFT')}
        >
          Borradores
        </Button>
        <Button
          variant={statusFilter === 'SENT' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setStatusFilter('SENT')}
        >
          Enviadas
        </Button>
      </div>

      {isLoading ? (
        <div className="text-center py-12">Cargando campañas...</div>
      ) : campaigns?.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-gray-500 mb-4">No hay campañas creadas</p>
            <Button onClick={() => setShowForm(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Crear Primera Campaña
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {campaigns?.map((campaign: any) => {
            const sentCount = campaign.recipients?.filter((r: any) => r.status === 'SENT').length || 0
            const totalRecipients = campaign.recipients?.length || 0

            return (
              <Card key={campaign.id}>
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        {campaign.name}
                        <Badge className={getStatusColor(campaign.status)}>
                          {getStatusLabel(campaign.status)}
                        </Badge>
                      </CardTitle>
                      <CardDescription className="mt-1">
                        {campaign.subject}
                      </CardDescription>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedCampaign(campaign.id)}
                        title="Ver detalles"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      {campaign.status === 'DRAFT' && (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setEditingCampaignId(campaign.id)
                              setShowForm(true)
                            }}
                            title="Editar"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              if (confirm('¿Eliminar esta campaña?')) {
                                deleteMutation.mutate(campaign.id)
                              }
                            }}
                            title="Eliminar"
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <span className="text-gray-500">Creada:</span>
                      <p className="font-medium">{formatDate(campaign.createdAt)}</p>
                    </div>
                    <div>
                      <span className="text-gray-500">Destinatarios:</span>
                      <p className="font-medium flex items-center gap-1">
                        <Users className="h-4 w-4" />
                        {sentCount} / {totalRecipients}
                      </p>
                    </div>
                    {campaign.sentAt && (
                      <div>
                        <span className="text-gray-500">Enviada:</span>
                        <p className="font-medium">{formatDateTime(campaign.sentAt)}</p>
                      </div>
                    )}
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

