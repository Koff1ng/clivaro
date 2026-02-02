'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useDebounce } from '@/lib/hooks/use-debounce'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { StockAdjustmentForm } from './adjustment-form'
import { StockTransferForm } from './transfer-form'
import { formatCurrency } from '@/lib/utils'
import { Search, Plus, AlertTriangle, ArrowRightLeft } from 'lucide-react'

async function fetchStockLevels(page: number, search: string, warehouseId: string) {
  const params = new URLSearchParams({
    page: page.toString(),
    limit: '50',
  })
  if (search) params.append('search', search)
  if (warehouseId) params.append('warehouseId', warehouseId)

  const res = await fetch(`/api/inventory/stock-levels?${params}`)
  if (!res.ok) throw new Error('Failed to fetch stock levels')
  return res.json()
}

async function fetchWarehouses() {
  const res = await fetch('/api/warehouses')
  if (!res.ok) throw new Error('Failed to fetch warehouses')
  return res.json()
}

export function StockLevels() {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [selectedWarehouse, setSelectedWarehouse] = useState<string>('')
  const [isAdjustmentOpen, setIsAdjustmentOpen] = useState(false)
  const [isTransferOpen, setIsTransferOpen] = useState(false)
  const [selectedItem, setSelectedItem] = useState<any>(null)
  const debouncedSearch = useDebounce(search, 500)

  const { data: warehouses = [] } = useQuery({
    queryKey: ['warehouses'],
    queryFn: fetchWarehouses,
    staleTime: 10 * 60 * 1000, // 10 minutes - warehouses rarely change
    gcTime: 30 * 60 * 1000,
  })

  const { data, isLoading, isPlaceholderData } = useQuery({
    queryKey: ['stock-levels', page, debouncedSearch, selectedWarehouse],
    queryFn: () => fetchStockLevels(page, debouncedSearch, selectedWarehouse),
    staleTime: 10 * 1000,
    gcTime: 5 * 60 * 1000,
    refetchInterval: 30 * 1000,
    refetchOnWindowFocus: true,
    placeholderData: (prev) => prev,
  })

  const handleAdjustment = (item: any) => {
    setSelectedItem(item)
    setIsAdjustmentOpen(true)
  }

  const handleTransfer = (item: any) => {
    setSelectedItem(item)
    setIsTransferOpen(true)
  }

  if (isLoading && !data) {
    return (
      <div className="flex flex-col items-center justify-center h-64 space-y-4">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        <div className="text-muted-foreground animate-pulse">Cargando niveles de stock...</div>
      </div>
    )
  }

  const { stockLevels, pagination } = data || { stockLevels: [], pagination: { totalPages: 1 } }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Buscar producto..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
            className="pl-10"
          />
          {(isLoading || isPlaceholderData) && (
            <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          )}
        </div>
        <select
          value={selectedWarehouse}
          onChange={(e) => {
            setSelectedWarehouse(e.target.value)
            setPage(1)
          }}
          className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          <option value="">Todos los almacenes</option>
          {warehouses.map((wh: any) => (
            <option key={wh.id} value={wh.id}>{wh.name}</option>
          ))}
        </select>
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Producto</TableHead>
              <TableHead>SKU</TableHead>
              <TableHead>Almacén</TableHead>
              <TableHead>Zona</TableHead>
              <TableHead>Stock</TableHead>
              <TableHead>Mínimo</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {stockLevels.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-gray-500">
                  No hay productos en inventario
                </TableCell>
              </TableRow>
            ) : (
              stockLevels.map((item: any) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{item.productName}</TableCell>
                  <TableCell>{item.productSku}</TableCell>
                  <TableCell>{item.warehouseName}</TableCell>
                  <TableCell>
                    <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-100">
                      {item.zoneName || 'General'}
                    </span>
                  </TableCell>
                  <TableCell>{item.quantity.toFixed(2)} {item.unitOfMeasure}</TableCell>
                  <TableCell>{item.minStock.toFixed(2)} {item.unitOfMeasure}</TableCell>
                  <TableCell>
                    {item.isLowStock ? (
                      <span className="flex items-center gap-1 text-orange-600">
                        <AlertTriangle className="h-4 w-4" />
                        Bajo
                      </span>
                    ) : (
                      <span className="text-green-600">OK</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleAdjustment(item)}
                        title="Ajustar stock"
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleTransfer(item)}
                        title="Transferir"
                      >
                        <ArrowRightLeft className="h-4 w-4" />
                      </Button>
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
            Página {pagination.page} de {pagination.totalPages}
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

      <Dialog open={isAdjustmentOpen} onOpenChange={setIsAdjustmentOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ajuste de Stock</DialogTitle>
          </DialogHeader>
          <StockAdjustmentForm
            item={selectedItem}
            onSuccess={() => {
              setIsAdjustmentOpen(false)
              setSelectedItem(null)
            }}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={isTransferOpen} onOpenChange={setIsTransferOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Transferencia de Stock</DialogTitle>
          </DialogHeader>
          <StockTransferForm
            item={selectedItem}
            warehouses={warehouses}
            onSuccess={() => {
              setIsTransferOpen(false)
              setSelectedItem(null)
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  )
}

