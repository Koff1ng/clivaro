'use client'

import { useState, useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useToast } from '@/components/ui/toast'
import { ReceiptForm } from './receipt-form'
import { ReceiptDetails } from './receipt-details'
import { formatCurrency, formatDate } from '@/lib/utils'
import { Search, Plus, Eye, Loader2, PackagePlus, FileText } from 'lucide-react'

async function fetchReceipts(page: number, search: string, purchaseOrderId: string) {
  const params = new URLSearchParams({
    page: page.toString(),
    limit: '50',
  })
  if (search) params.append('search', search)
  if (purchaseOrderId) params.append('purchaseOrderId', purchaseOrderId)

  const res = await fetch(`/api/purchases/receipts?${params}`)
  if (!res.ok) throw new Error('Failed to fetch receipts')
  return res.json()
}

async function fetchPurchaseOrders() {
  // Fetch all orders and filter those that can be received
  const res = await fetch('/api/purchases/orders?limit=1000')
  if (!res.ok) return []
  const data = await res.json()
  // Filter orders that can be received (not RECEIVED or CANCELLED)
  const orders = data.orders || []
  return orders.filter((order: any) => order.status !== 'RECEIVED' && order.status !== 'CANCELLED')
}

export function ReceiptList() {
  const { toast } = useToast()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [purchaseOrderFilter, setPurchaseOrderFilter] = useState('')
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [selectedPurchaseOrder, setSelectedPurchaseOrder] = useState<any>(null)
  const [viewReceipt, setViewReceipt] = useState<any>(null)
  const queryClient = useQueryClient()

  const { data: purchaseOrders = [] } = useQuery({
    queryKey: ['purchase-orders-sent'],
    queryFn: fetchPurchaseOrders,
  })

  const { data, isLoading } = useQuery({
    queryKey: ['receipts', page, search, purchaseOrderFilter],
    queryFn: () => fetchReceipts(page, search, purchaseOrderFilter),
  })

  const handleView = async (receipt: any) => {
    try {
      const res = await fetch(`/api/purchases/receipts/${receipt.id}`)
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        throw new Error(errorData.error || `Error ${res.status}: ${res.statusText}`)
      }
      const data = await res.json()
      setViewReceipt(data)
    } catch (error: any) {
      console.error('Error loading receipt details:', error)
      toast(error.message || 'Error al cargar los detalles de la recepción', 'error')
    }
  }

  const { receipts, pagination } = useMemo(() => {
    return data || { receipts: [], pagination: { totalPages: 1 } }
  }, [data])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Buscar recepciones (número, orden)..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
            className="pl-10"
          />
        </div>
        <div className="flex gap-2">
          <select
            value={purchaseOrderFilter}
            onChange={(e) => {
              setPurchaseOrderFilter(e.target.value)
              setPage(1)
            }}
            className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="">Todas las órdenes</option>
            {purchaseOrders.map((order: any) => (
              <option key={order.id} value={order.id}>
                {order.number} - {order.supplier?.name}
              </option>
            ))}
          </select>
          <Button onClick={() => {
            setSelectedPurchaseOrder(null)
            setIsFormOpen(true)
          }}>
            <Plus className="h-4 w-4 mr-2" />
            Nueva Recepción
          </Button>
        </div>
      </div>

      {isLoading && receipts.length === 0 ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground mr-2" />
          <span className="text-muted-foreground">Cargando recepciones...</span>
        </div>
      ) : (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Número</TableHead>
                <TableHead>Orden de Compra</TableHead>
                <TableHead>Proveedor</TableHead>
                <TableHead>Almacén</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {receipts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-gray-500">
                    No hay recepciones
                  </TableCell>
                </TableRow>
              ) : (
                receipts.map((receipt: any) => (
                  <TableRow key={receipt.id}>
                    <TableCell className="font-medium">{receipt.number}</TableCell>
                    <TableCell>{receipt.purchaseOrder?.number || '-'}</TableCell>
                    <TableCell>{receipt.purchaseOrder?.supplier?.name || '-'}</TableCell>
                    <TableCell>{receipt.warehouse?.name || '-'}</TableCell>
                    <TableCell>{formatDate(receipt.receivedAt || receipt.createdAt)}</TableCell>
                    <TableCell>{formatCurrency(receipt.total || 0)}</TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleView(receipt)}
                        title="Ver detalles"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-600">
            Página {pagination.page} de {pagination.totalPages} ({pagination.total} recepciones)
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              Anterior
            </Button>
            <Button
              variant="outline"
              onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))}
              disabled={page === pagination.totalPages}
            >
              Siguiente
            </Button>
          </div>
        </div>
      )}

      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="w-auto sm:max-w-fit max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PackagePlus className="h-5 w-5" />
              Nueva Recepción de Mercancía
            </DialogTitle>
          </DialogHeader>
          <ReceiptForm
            purchaseOrderId={selectedPurchaseOrder}
            onSuccess={() => {
              setIsFormOpen(false)
              setSelectedPurchaseOrder(null)
            }}
          />
        </DialogContent>
      </Dialog>

      {viewReceipt && (
        <Dialog open={!!viewReceipt} onOpenChange={() => setViewReceipt(null)}>
          <DialogContent className="w-auto sm:max-w-fit max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Detalles de la Recepción
              </DialogTitle>
            </DialogHeader>
            <ReceiptDetails receipt={viewReceipt} />
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}

