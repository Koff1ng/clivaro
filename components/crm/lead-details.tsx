'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ActivityForm } from './activity-form'
import { formatCurrency, formatDate, formatDateTime } from '@/lib/utils'
import { Mail, Phone, Building, User, Calendar, CheckCircle, XCircle, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function LeadDetails({ lead: initialLead }: { lead: any }) {
  const [isActivityFormOpen, setIsActivityFormOpen] = useState(false)
  const queryClient = useQueryClient()

  const { data: lead = initialLead } = useQuery({
    queryKey: ['lead', initialLead.id],
    queryFn: async () => {
      const res = await fetch(`/api/leads/${initialLead.id}`)
      return res.json()
    },
    initialData: initialLead,
  })

  const completeActivityMutation = useMutation({
    mutationFn: async ({ id, completed }: { id: string; completed: boolean }) => {
      const res = await fetch(`/api/activities/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completed }),
      })
      if (!res.ok) throw new Error('Failed to update activity')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lead', lead.id] })
    },
  })

  const getStageColor = (stage: string) => {
    switch (stage) {
      case 'NEW': return 'bg-blue-100 text-blue-800'
      case 'CONTACTED': return 'bg-yellow-100 text-yellow-800'
      case 'QUOTED': return 'bg-purple-100 text-purple-800'
      case 'WON': return 'bg-green-100 text-green-800'
      case 'LOST': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getStageLabel = (stage: string) => {
    const labels: Record<string, string> = {
      NEW: 'Nueva',
      CONTACTED: 'Contactado',
      QUOTED: 'Cotizado',
      WON: 'Ganada',
      LOST: 'Perdida',
    }
    return labels[stage] || stage
  }

  const getTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      CALL: 'Llamada',
      EMAIL: 'Email',
      MEETING: 'Reunión',
      TASK: 'Tarea',
      NOTE: 'Nota',
    }
    return labels[type] || type
  }

  return (
    <div className="space-y-6">
      {/* Header Info */}
      <div className="grid grid-cols-2 gap-6">
        <div>
          <h2 className="text-2xl font-bold mb-4">{lead.name}</h2>
          <div className="space-y-2 text-sm">
            {lead.company && (
              <div className="flex items-center gap-2">
                <Building className="h-4 w-4 text-gray-400" />
                <span>{lead.company}</span>
              </div>
            )}
            {lead.email && (
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-gray-400" />
                <span>{lead.email}</span>
              </div>
            )}
            {lead.phone && (
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-gray-400" />
                <span>{lead.phone}</span>
              </div>
            )}
            {lead.source && (
              <div className="text-gray-600">Origen: {lead.source}</div>
            )}
            {lead.assignedTo && (
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-gray-400" />
                <span>Asignado a: {lead.assignedTo.name}</span>
              </div>
            )}
          </div>
        </div>
        <div>
          <h3 className="font-semibold mb-3">Información</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Estado:</span>
              <span className={`px-2 py-1 text-xs rounded ${getStageColor(lead.stage)}`}>
                {getStageLabel(lead.stage)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Probabilidad:</span>
              <span className="font-semibold">{lead.probability || 0}%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Ingreso Esperado:</span>
              <span className="font-semibold">{formatCurrency(lead.expectedRevenue || 0)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Creado:</span>
              <span>{formatDate(lead.createdAt)}</span>
            </div>
          </div>
        </div>
      </div>

      {lead.notes && (
        <div>
          <h3 className="font-semibold mb-2">Notas</h3>
          <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded">{lead.notes}</p>
        </div>
      )}

      {/* Tabs */}
      <Tabs defaultValue="activities" className="w-full">
        <TabsList>
          <TabsTrigger value="activities">Actividades</TabsTrigger>
          <TabsTrigger value="quotations">Cotizaciones</TabsTrigger>
          <TabsTrigger value="history">Historial</TabsTrigger>
        </TabsList>
        
        <TabsContent value="activities" className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => setIsActivityFormOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Nueva Actividad
            </Button>
          </div>
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Asunto</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Vencimiento</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Usuario</TableHead>
                  <TableHead>Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lead.activities?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-gray-500">
                      No hay actividades
                    </TableCell>
                  </TableRow>
                ) : (
                  lead.activities?.map((activity: any) => (
                    <TableRow key={activity.id}>
                      <TableCell>{getTypeLabel(activity.type)}</TableCell>
                      <TableCell className="font-medium">{activity.subject}</TableCell>
                      <TableCell>{formatDateTime(activity.createdAt)}</TableCell>
                      <TableCell>
                        {activity.dueDate ? formatDate(activity.dueDate) : '-'}
                      </TableCell>
                      <TableCell>
                        {activity.completed ? (
                          <span className="flex items-center gap-1 text-green-600">
                            <CheckCircle className="h-4 w-4" />
                            Completada
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-yellow-600">
                            <XCircle className="h-4 w-4" />
                            Pendiente
                          </span>
                        )}
                      </TableCell>
                      <TableCell>{activity.createdBy?.name || '-'}</TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => completeActivityMutation.mutate({
                            id: activity.id,
                            completed: !activity.completed,
                          })}
                        >
                          {activity.completed ? 'Marcar Pendiente' : 'Marcar Completada'}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="quotations" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="font-semibold">Cotizaciones</h3>
            <Button
              onClick={() => {
                // Abrir el formulario de cotización con el leadId prellenado
                const url = new URL(window.location.origin + '/sales/quotes')
                url.searchParams.set('leadId', lead.id)
                url.searchParams.set('new', 'true')
                window.location.href = url.toString()
              }}
            >
              <Plus className="h-4 w-4 mr-2" />
              Crear Cotización
            </Button>
          </div>
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Número</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lead.quotations?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-gray-500">
                      No hay cotizaciones
                    </TableCell>
                  </TableRow>
                ) : (
                  lead.quotations?.map((quotation: any) => (
                    <TableRow key={quotation.id}>
                      <TableCell className="font-medium">{quotation.number}</TableCell>
                      <TableCell>{formatDate(quotation.createdAt)}</TableCell>
                      <TableCell>
                        <span className={`px-2 py-1 text-xs rounded ${
                          quotation.status === 'ACCEPTED' ? 'bg-green-100 text-green-800' :
                          quotation.status === 'SENT' ? 'bg-blue-100 text-blue-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {quotation.status === 'ACCEPTED' ? 'Aceptada' :
                           quotation.status === 'SENT' ? 'Enviada' : 'Borrador'}
                        </span>
                      </TableCell>
                      <TableCell>{formatCurrency(quotation.total)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          <h3 className="font-semibold">Historial de Cambios de Estado</h3>
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Estado Anterior</TableHead>
                  <TableHead>Estado Nuevo</TableHead>
                  <TableHead>Cambiado por</TableHead>
                  <TableHead>Notas</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lead.stageHistory?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-gray-500">
                      No hay historial de cambios
                    </TableCell>
                  </TableRow>
                ) : (
                  lead.stageHistory?.map((history: any) => (
                    <TableRow key={history.id}>
                      <TableCell>{formatDateTime(history.changedAt)}</TableCell>
                      <TableCell>
                        <span className={`px-2 py-1 text-xs rounded ${
                          history.fromStage === 'WON' ? 'bg-green-100 text-green-800' :
                          history.fromStage === 'LOST' ? 'bg-red-100 text-red-800' :
                          history.fromStage === 'QUOTED' ? 'bg-purple-100 text-purple-800' :
                          history.fromStage === 'CONTACTED' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-blue-100 text-blue-800'
                        }`}>
                          {history.fromStage || 'N/A'}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className={`px-2 py-1 text-xs rounded ${
                          history.toStage === 'WON' ? 'bg-green-100 text-green-800' :
                          history.toStage === 'LOST' ? 'bg-red-100 text-red-800' :
                          history.toStage === 'QUOTED' ? 'bg-purple-100 text-purple-800' :
                          history.toStage === 'CONTACTED' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-blue-100 text-blue-800'
                        }`}>
                          {history.toStage}
                        </span>
                      </TableCell>
                      <TableCell>{history.changedBy?.name || '-'}</TableCell>
                      <TableCell>{history.notes || '-'}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={isActivityFormOpen} onOpenChange={setIsActivityFormOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nueva Actividad</DialogTitle>
          </DialogHeader>
          <ActivityForm
            leadId={lead.id}
            onSuccess={() => {
              setIsActivityFormOpen(false)
              queryClient.invalidateQueries({ queryKey: ['lead', lead.id] })
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  )
}

