'use client'

import React, { useState, useMemo, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import dynamic from 'next/dynamic'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useToast } from '@/components/ui/toast'
import { useDebounce } from '@/lib/hooks/use-debounce'
import { formatCurrency, formatDate } from '@/lib/utils'
import { Search, Plus, Eye, Edit, Trash2 } from 'lucide-react'

// Lazy load heavy components
const PurchaseOrderForm = dynamic(() => import('./purchase-order-form').then(mod => ({ default: mod.PurchaseOrderForm })), {
  loading: () => <div className="p-4">Cargando formulario...</div>,
})
const PurchaseOrderDetails = dynamic(() => import('./purchase-order-details').then(mod => ({ default: mod.PurchaseOrderDetails })), {
  loading: () => <div className="p-4">Cargando detalles...</div>,
})

async function fetchPurchaseOrders(page: number, search: string, status: string, supplierId: string) {
  const params = new URLSearchParams({
    page: page.toString(),
    limit: '50',
  })
  if (search) params.append('search', search)
  if (status) params.append('status', status)
  if (supplierId) params.append('supplierId', supplierId)
  
  const res = await fetch(`/api/purchases/orders?${params}`)
  if (!res.ok) throw new Error('Failed to fetch purchase orders')
  return res.json()
}

async function fetchSuppliers() {
  const res = await fetch('/api/suppliers?limit=1000')
  if (!res.ok) return []
  const data = await res.json()
  return data.suppliers || []
}

export function PurchaseOrderList() {
  const { toast } = useToast()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [supplierFilter, setSupplierFilter] = useState('')
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [selectedOrder, setSelectedOrder] = useState<any>(null)
  const [viewOrder, setViewOrder] = useState<any>(null)
  const queryClient = useQueryClient()

  // Debounce search to avoid excessive queries
  const debouncedSearch = useDebounce(search, 500)

  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value)
    setPage(1)
  }, [])

  const { data: suppliers = [] } = useQuery({
    queryKey: ['suppliers'],
    queryFn: fetchSuppliers,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000,
  })

  const { data, isLoading } = useQuery({
    queryKey: ['purchase-orders', page, debouncedSearch, statusFilter, supplierFilter],
    queryFn: () => fetchPurchaseOrders(page, debouncedSearch, statusFilter, supplierFilter),
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 5 * 60 * 1000,
    placeholderData: (prev) => prev,
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/purchases/orders/${id}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to delete order')
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] })
    },
  })

  const handleEdit = (order: any) => {
    setSelectedOrder(order)
    setIsFormOpen(true)
  }

  const handleDelete = async (order: any) => {
    if (confirm(`¿Estás seguro de eliminar la orden ${order.number}?`)) {
      try {
        await deleteMutation.mutateAsync(order.id)
      } catch (error: any) {
        toast(error.message || 'Error al eliminar orden', 'error')
      }
    }
  }

  const handleView = async (order: any) => {
    try {
      const res = await fetch(`/api/purchases/orders/${order.id}`)
      if (!res.ok) {
        throw new Error('Error al cargar los detalles')
      }
      const data = await res.json()
      setViewOrder(data)
    } catch (error: any) {
      toast(error.message || 'Error al cargar los detalles', 'error')
    }
  }

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

  const { orders, pagination } = useMemo(() => {
    return data || { orders: [], pagination: { totalPages: 1 } }
  }, [data])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Buscar órdenes (número, proveedor)..."
            value={search}
            onChange={handleSearchChange}
            className="pl-10"
          />
        </div>
        <div className="flex gap-2">
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value)
              setPage(1)
            }}
            className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="">Todos los estados</option>
            <option value="DRAFT">Borrador</option>
            <option value="SENT">Enviada</option>
            <option value="RECEIVED">Recibida</option>
            <option value="CANCELLED">Cancelada</option>
          </select>
          <select
            value={supplierFilter}
            onChange={(e) => {
              setSupplierFilter(e.target.value)
              setPage(1)
            }}
            className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="">Todos los proveedores</option>
            {suppliers.map((supplier: any) => (
              <option key={supplier.id} value={supplier.id}>{supplier.name}</option>
            ))}
          </select>
        </div>
        <Button onClick={() => {
          setSelectedOrder(null)
          setIsFormOpen(true)
        }}>
          <Plus className="h-4 w-4 mr-2" />
          Nueva Orden
        </Button>
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Número</TableHead>
              <TableHead>Proveedor</TableHead>
              <TableHead>Fecha</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Total</TableHead>
              <TableHead>Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-gray-500">
                  No hay órdenes de compra
                </TableCell>
              </TableRow>
            ) : (
              orders.map((order: any) => (
                <TableRow key={order.id}>
                  <TableCell className="font-medium">{order.number}</TableCell>
                  <TableCell>{order.supplier?.name || '-'}</TableCell>
                  <TableCell>{formatDate(order.createdAt)}</TableCell>
                  <TableCell>
                    <span className={`px-2 py-1 text-xs rounded ${getStatusColor(order.status)}`}>
                      {getStatusLabel(order.status)}
                    </span>
                  </TableCell>
                  <TableCell>{formatCurrency(order.total)}</TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleView(order)}
                        title="Ver detalles"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(order)}
                        title="Editar"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      {order.status === 'DRAFT' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(order)}
                          title="Eliminar"
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-600">
            Página {pagination.page} de {pagination.totalPages} ({pagination.total} órdenes)
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
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedOrder ? 'Editar Orden de Compra' : 'Nueva Orden de Compra'}
            </DialogTitle>
          </DialogHeader>
          <PurchaseOrderForm
            order={selectedOrder}
            onSuccess={() => {
              setIsFormOpen(false)
              setSelectedOrder(null)
            }}
          />
        </DialogContent>
      </Dialog>

      {viewOrder && (
        <Dialog open={!!viewOrder} onOpenChange={() => setViewOrder(null)}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Detalles de la Orden de Compra</DialogTitle>
            </DialogHeader>
            <PurchaseOrderDetails order={viewOrder} />
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}

