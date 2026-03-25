'use client'

import { useState, useRef } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { formatCurrency, formatDate } from '@/lib/utils'
import { useToast } from '@/components/ui/toast'
import { Mail, Phone, MapPin, FileText, Package, CheckCircle, XCircle, Upload, Download, Trash2, Paperclip, Loader2 } from 'lucide-react'

export function PurchaseOrderDetails({ order }: { order: any }) {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [selectedFileType, setSelectedFileType] = useState('FACTURA')
  const [isUploading, setIsUploading] = useState(false)

  const FILE_TYPE_LABELS: Record<string, string> = {
    'FACTURA': 'Factura del Proveedor',
    'ACUSE_RECIBO': 'Acuse de Recibo',
    'NOTA_CREDITO': 'Nota Crédito',
    'REMISION': 'Remisión',
    'SOPORTE_PAGO': 'Soporte de Pago',
    'OTRO': 'Otro Documento',
  }

  // Fetch attachments
  const { data: attachmentsData, isLoading: isLoadingAttachments } = useQuery({
    queryKey: ['po-attachments', order.id],
    queryFn: async () => {
      const res = await fetch(`/api/purchases/orders/${order.id}/attachments`)
      if (!res.ok) throw new Error('Failed')
      return res.json()
    }
  })

  const attachments = attachmentsData?.attachments || []

  // Upload handler
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsUploading(true)
    try {
      // 1. Upload file to Supabase Storage
      const formData = new FormData()
      formData.append('file', file)
      const uploadRes = await fetch('/api/uploads', { method: 'POST', body: formData })
      if (!uploadRes.ok) { const err = await uploadRes.json(); throw new Error(err.error || 'Upload failed') }
      const uploadData = await uploadRes.json()

      // 2. Create attachment record
      const attachRes = await fetch(`/api/purchases/orders/${order.id}/attachments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: uploadData.fileName,
          fileUrl: uploadData.fileUrl,
          fileType: selectedFileType,
          fileSize: uploadData.fileSize,
          mimeType: uploadData.mimeType,
        }),
      })
      if (!attachRes.ok) { const err = await attachRes.json(); throw new Error(err.error || 'Failed to save') }

      queryClient.invalidateQueries({ queryKey: ['po-attachments', order.id] })
      toast('Documento adjuntado exitosamente', 'success')
    } catch (err: any) {
      toast(err.message || 'Error al subir archivo', 'error')
    } finally {
      setIsUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  // Delete attachment
  const deleteAttachmentMutation = useMutation({
    mutationFn: async (attachmentId: string) => {
      const res = await fetch(`/api/purchases/orders/${order.id}/attachments?attachmentId=${attachmentId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['po-attachments', order.id] })
      toast('Documento eliminado', 'success')
    },
    onError: () => toast('Error al eliminar documento', 'error'),
  })

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const updateStatusMutation = useMutation({
    mutationFn: async (status: string) => {
      const res = await fetch(`/api/purchases/orders/${order.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Error al actualizar estado')
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] })
      toast('Estado actualizado exitosamente', 'success')
      window.location.reload()
    },
  })

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'RECEIVED':
        return 'bg-green-100 text-green-800'
      case 'SENT':
        return 'bg-blue-100 text-blue-800'
      case 'DRAFT':
        return 'bg-gray-100 text-gray-800'
      case 'CANCELLED':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      DRAFT: 'Borrador',
      SENT: 'Enviada',
      RECEIVED: 'Recibida',
      CANCELLED: 'Cancelada',
    }
    return labels[status] || status
  }

  const handleStatusChange = (newStatus: string) => {
    if (confirm(`¿Cambiar el estado a "${getStatusLabel(newStatus)}"?`)) {
      updateStatusMutation.mutate(newStatus)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-2xl font-bold">{order.number}</h2>
          <div className="mt-2">
            <span className={`px-3 py-1 text-sm rounded ${getStatusColor(order.status)}`}>
              {getStatusLabel(order.status)}
            </span>
          </div>
        </div>
        {order.status === 'DRAFT' && (
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => handleStatusChange('SENT')}
              disabled={updateStatusMutation.isPending}
            >
              Marcar como Enviada
            </Button>
            <Button
              variant="outline"
              onClick={() => handleStatusChange('CANCELLED')}
              disabled={updateStatusMutation.isPending}
              className="text-red-600"
            >
              Cancelar
            </Button>
          </div>
        )}
        {order.status === 'SENT' && (
          <div className="flex gap-2">
            <Button
              onClick={() => handleStatusChange('RECEIVED')}
              disabled={updateStatusMutation.isPending}
            >
              Marcar como Recibida
            </Button>
          </div>
        )}
      </div>

      {/* Supplier Info */}
      <div className="grid grid-cols-2 gap-6">
        <div>
          <h3 className="font-semibold mb-3">Proveedor</h3>
          <div className="space-y-2 text-sm">
            <div className="font-medium">{order.supplier?.name}</div>
            {order.supplier?.taxId && (
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-gray-400" />
                <span>NIT: {order.supplier.taxId}</span>
              </div>
            )}
            {order.supplier?.email && (
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-gray-400" />
                <span>{order.supplier.email}</span>
              </div>
            )}
            {order.supplier?.phone && (
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-gray-400" />
                <span>{order.supplier.phone}</span>
              </div>
            )}
            {order.supplier?.address && (
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-gray-400" />
                <span>{order.supplier.address}</span>
              </div>
            )}
          </div>
        </div>
        <div>
          <h3 className="font-semibold mb-3">Información</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Fecha Creación:</span>
              <span>{formatDate(order.createdAt)}</span>
            </div>
            {order.expectedDate && (
              <div className="flex justify-between">
                <span className="text-gray-600">Fecha Esperada:</span>
                <span>{formatDate(order.expectedDate)}</span>
              </div>
            )}
            {order.goodsReceipts && order.goodsReceipts.length > 0 && (
              <div className="flex justify-between">
                <span className="text-gray-600">Recepciones:</span>
                <span>{order.goodsReceipts.length}</span>
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
                <TableHead>Código</TableHead>
                <TableHead>Producto</TableHead>
                <TableHead>Cantidad</TableHead>
                <TableHead>Costo Unit.</TableHead>
                <TableHead>IVA</TableHead>
                <TableHead>Subtotal</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {order.items?.map((item: any) => (
                <TableRow key={item.id}>
                  <TableCell className="font-mono text-xs">{item.product?.sku || '-'}</TableCell>
                  <TableCell>
                    <div>
                      <div className="font-medium">{item.product?.name}</div>
                    </div>
                  </TableCell>
                  <TableCell>{item.quantity}</TableCell>
                  <TableCell>{formatCurrency(item.unitCost)}</TableCell>
                  <TableCell>{item.taxRate}%</TableCell>
                  <TableCell>{formatCurrency(item.subtotal)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Totals */}
      <div className="flex justify-end">
        <div className="w-64 space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600">Subtotal:</span>
            <span>{formatCurrency(order.subtotal + order.discount)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Descuento:</span>
            <span>{formatCurrency(order.discount)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">IVA:</span>
            <span>{formatCurrency(order.tax)}</span>
          </div>
          <div className="flex justify-between border-t pt-2 font-bold text-lg">
            <span>Total:</span>
            <span>{formatCurrency(order.total)}</span>
          </div>
        </div>
      </div>

      {/* Goods Receipts */}
      {order.goodsReceipts && order.goodsReceipts.length > 0 && (
        <div>
          <h3 className="font-semibold mb-3">Recepciones</h3>
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Número</TableHead>
                  <TableHead>Fecha Recepción</TableHead>
                  <TableHead>Fecha Creación</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {order.goodsReceipts.map((receipt: any) => (
                  <TableRow key={receipt.id}>
                    <TableCell className="font-medium">{receipt.number}</TableCell>
                    <TableCell>{formatDate(receipt.receivedAt)}</TableCell>
                    <TableCell>{formatDate(receipt.createdAt)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {order.notes && (
        <div>
          <h3 className="font-semibold mb-2">Notas</h3>
          <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded">{order.notes}</p>
        </div>
      )}

      {/* Attachments */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold flex items-center gap-2">
            <Paperclip className="h-4 w-4" />
            Documentos Adjuntos
          </h3>
          <div className="flex items-center gap-2">
            <select
              value={selectedFileType}
              onChange={(e) => setSelectedFileType(e.target.value)}
              className="h-8 text-xs rounded-md border border-input bg-background px-2"
            >
              {Object.entries(FILE_TYPE_LABELS).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx,.xml"
              onChange={handleFileUpload}
            />
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="gap-1 h-8 text-xs"
            >
              {isUploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
              {isUploading ? 'Subiendo...' : 'Adjuntar'}
            </Button>
          </div>
        </div>

        {attachments.length > 0 ? (
          <div className="border rounded-lg divide-y">
            {attachments.map((att: any) => (
              <div key={att.id} className="flex items-center justify-between p-3 hover:bg-gray-50">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded bg-blue-50 flex items-center justify-center">
                    <FileText className="h-4 w-4 text-blue-600" />
                  </div>
                  <div>
                    <div className="text-sm font-medium">{att.fileName}</div>
                    <div className="text-[10px] text-gray-400 flex items-center gap-2">
                      <span className="bg-gray-100 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase">
                        {FILE_TYPE_LABELS[att.fileType] || att.fileType}
                      </span>
                      <span>{formatFileSize(att.fileSize)}</span>
                      <span>{formatDate(att.createdAt)}</span>
                    </div>
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 text-blue-600"
                    onClick={() => window.open(att.fileUrl, '_blank')}
                    title="Descargar"
                  >
                    <Download className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 text-red-500"
                    onClick={() => {
                      if (confirm('¿Eliminar este documento?')) {
                        deleteAttachmentMutation.mutate(att.id)
                      }
                    }}
                    title="Eliminar"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="border border-dashed rounded-lg p-6 text-center text-sm text-gray-400">
            <Paperclip className="h-6 w-6 mx-auto mb-2 opacity-30" />
            Sin documentos adjuntos. Sube facturas, acuses de recibo, notas crédito, etc.
          </div>
        )}
      </div>
    </div>
  )
}

