'use client'

import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { formatCurrency, formatDate } from '@/lib/utils'
import { useToast } from '@/components/ui/toast'
import { LoadingOverlay } from '@/components/ui/loading-overlay'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { FileText, Phone, MapPin, CheckCircle } from 'lucide-react'
import { Mail } from 'iconoir-react'

export function QuotationDetails({ quotation }: { quotation: any }) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [confirmSendOpen, setConfirmSendOpen] = useState(false)
  const [confirmMode, setConfirmMode] = useState<'send' | 'resend' | null>(null)
  const queryClient = useQueryClient()

  // Validar y normalizar datos
  if (!quotation) {
    return <div className="p-8 text-center text-red-600">Error: No se pudo cargar la cotización</div>
  }

  const quotationItems = Array.isArray(quotation?.items) ? quotation.items : []

  const convertMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/quotations/${quotation.id}/convert`, {
        method: 'POST',
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Error al convertir cotización')
      }
      return res.json()
    },
    onSuccess: (invoice) => {
      queryClient.invalidateQueries({ queryKey: ['quotations'] })
      queryClient.invalidateQueries({ queryKey: ['invoices'] })
      toast(`Cotización convertida a factura: ${invoice.number}`, 'success')
    },
    onError: (error: any) => {
      const message = error?.message || 'No se pudo convertir la cotización en factura'
      toast(message, 'error')
    },
  })

  const sendMutation = useMutation({
    mutationFn: async () => {
      setSending(true)
      const res = await fetch(`/api/quotations/${quotation.id}/send`, {
        method: 'POST',
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.message || data.error || 'Error al enviar cotización')
      }
      return data
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['quotations'] })
      queryClient.invalidateQueries({ queryKey: ['activity-feed'] })
      setSending(false)
      if (data.emailSent) {
        toast(data.message || `Cotización enviada exitosamente a ${data.email}`, 'success')
      } else {
        const errorDetails = data.emailError === 'SMTP not configured'
          ? 'El servicio de email no está configurado. Configure las variables SMTP en .env'
          : data.emailMessage || data.emailError || 'Error desconocido'
        toast(`Error al enviar el email: ${errorDetails} - Email destino: ${data.email}`, 'error')
      }
    },
    onError: (error: any) => {
      setSending(false)
      const errorMessage = error.message || 'No se pudo enviar la cotización'
      toast(`Error: ${errorMessage}`, 'error')
    },
  })

  const openSendConfirm = (mode: 'send' | 'resend') => {
    if (!quotation.customer?.email) {
      toast('El cliente no tiene un email registrado. Por favor, actualice los datos del cliente antes de enviar la cotización.', 'warning')
      return
    }
    setConfirmMode(mode)
    setConfirmSendOpen(true)
  }

  const handleConfirmSend = () => {
    if (!quotation?.id) return
    sendMutation.mutate()
    setConfirmSendOpen(false)
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'DRAFT': return 'bg-gray-100 text-gray-800'
      case 'SENT': return 'bg-blue-100 text-blue-800'
      case 'ACCEPTED': return 'bg-green-100 text-green-800'
      case 'EXPIRED': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      DRAFT: 'Borrador',
      SENT: 'Enviada',
      ACCEPTED: 'Aceptada',
      EXPIRED: 'Expirada',
    }
    return labels[status] || status
  }

  return (
    <>
      {sending && <LoadingOverlay message="Enviando cotización..." />}
      <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-2xl font-bold">{quotation.number}</h2>
          <div className="mt-2">
            <span className={`px-3 py-1 text-sm rounded ${getStatusColor(quotation.status)}`}>
              {getStatusLabel(quotation.status)}
            </span>
          </div>
        </div>
        <div className="flex gap-2">
          {quotation.status === 'DRAFT' && (
            <Button
              variant="outline"
              onClick={() => openSendConfirm('send')}
              disabled={sendMutation.isPending}
            >
              <Mail className="h-4 w-4 mr-2" />
              {sendMutation.isPending ? 'Enviando...' : 'Enviar por email'}
            </Button>
          )}
          {(quotation.status === 'SENT' || quotation.status === 'ACCEPTED') && (
            <>
              <Button
                variant="outline"
                onClick={() => openSendConfirm('resend')}
                disabled={sendMutation.isPending}
              >
                <Mail className="h-4 w-4 mr-2" />
                {sendMutation.isPending ? 'Reenviando...' : 'Reenviar por email'}
              </Button>
              {quotation.status === 'SENT' && (
                <Button
                  onClick={() => {
                    if (confirm('¿Convertir esta cotización en factura pagada?')) {
                      convertMutation.mutate()
                    }
                  }}
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Convertir a factura
                </Button>
              )}
            </>
          )}
        </div>
      </div>

      <Dialog open={confirmSendOpen} onOpenChange={setConfirmSendOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{confirmMode === 'resend' ? 'Reenviar cotización' : 'Enviar cotización'}</DialogTitle>
            <DialogDescription>
              {quotation?.customer?.email
                ? `Se enviará la cotización ${quotation.number} al correo ${quotation.customer.email}.`
                : 'El cliente no tiene un correo electrónico configurado.'}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmSendOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleConfirmSend} disabled={sendMutation.isPending}>
              {sendMutation.isPending ? 'Enviando...' : 'Confirmar envío'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Customer Info */}
      <div className="grid grid-cols-2 gap-6">
        <div>
          <h3 className="font-semibold mb-3">Cliente</h3>
          {quotation.customer ? (
            <div className="space-y-2 text-sm">
              <div className="font-medium">{quotation.customer.name || 'Sin nombre'}</div>
              {quotation.customer.taxId && (
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-gray-400" />
                  <span>NIT: {quotation.customer.taxId}</span>
                </div>
              )}
              {quotation.customer.email && (
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-gray-400" />
                  <span>{quotation.customer.email}</span>
                </div>
              )}
              {quotation.customer.phone && (
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-gray-400" />
                  <span>{quotation.customer.phone}</span>
                </div>
              )}
              {quotation.customer.address && (
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-gray-400" />
                  <span>{quotation.customer.address}</span>
                </div>
              )}
            </div>
          ) : (
            <div className="text-sm text-gray-500">Cliente no disponible</div>
          )}
        </div>
        <div>
          <h3 className="font-semibold mb-3">Información</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Fecha:</span>
              <span>{formatDate(quotation.createdAt)}</span>
            </div>
            {quotation.validUntil && (
              <div className="flex justify-between">
                <span className="text-gray-600">Válida Hasta:</span>
                <span>{formatDate(quotation.validUntil)}</span>
              </div>
            )}
            {quotation.lead && (
              <div className="flex justify-between">
                <span className="text-gray-600">Oportunidad:</span>
                <span>{quotation.lead.name}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Items */}
      <div>
        <h3 className="font-semibold mb-3">Productos</h3>
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Producto</TableHead>
                <TableHead>Cantidad</TableHead>
                <TableHead>Precio Unit.</TableHead>
                <TableHead>Descuento</TableHead>
                <TableHead>IVA</TableHead>
                <TableHead>Subtotal</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {quotationItems.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-gray-500 py-8">
                    No hay productos en esta cotización
                  </TableCell>
                </TableRow>
              ) : (
                quotationItems.map((item: any) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{item.product?.name || 'Producto sin nombre'}</div>
                        {item.product?.sku && (
                          <div className="text-sm text-gray-500">{item.product.sku}</div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{item.quantity || 0}</TableCell>
                    <TableCell>{formatCurrency(item.unitPrice || 0)}</TableCell>
                    <TableCell>{item.discount || 0}%</TableCell>
                    <TableCell>{item.taxRate || 0}%</TableCell>
                    <TableCell>{formatCurrency(item.subtotal || 0)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Totals */}
      <div className="flex justify-end">
        <div className="w-64 space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600">Subtotal:</span>
            <span>{formatCurrency((quotation.subtotal || 0) + (quotation.discount || 0))}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Descuento:</span>
            <span>{formatCurrency(quotation.discount || 0)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">IVA:</span>
            <span>{formatCurrency(quotation.tax || 0)}</span>
          </div>
          <div className="flex justify-between border-t pt-2 font-bold text-lg">
            <span>Total:</span>
            <span>{formatCurrency(quotation.total || 0)}</span>
          </div>
        </div>
      </div>

      {quotation.notes && (
        <div>
          <h3 className="font-semibold mb-2">Notas</h3>
          <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded">{quotation.notes}</p>
        </div>
      )}

    </div>
    </>
  )
}

