'use client'

import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { formatCurrency, formatDate } from '@/lib/utils'
import { useToast } from '@/components/ui/toast'
import { Mail, Phone, MapPin, FileText, Package, CheckCircle, XCircle } from 'lucide-react'

export function PurchaseOrderDetails({ order }: { order: any }) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const queryClient = useQueryClient()

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
              disabled={loading || updateStatusMutation.isPending}
            >
              Marcar como Enviada
            </Button>
            <Button
              variant="outline"
              onClick={() => handleStatusChange('CANCELLED')}
              disabled={loading || updateStatusMutation.isPending}
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
              disabled={loading || updateStatusMutation.isPending}
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
    </div>
  )
}

