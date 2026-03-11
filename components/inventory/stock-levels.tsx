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

interface StockLevelItem {
  id: string
  productId: string
  productName: string
  productSku: string
  warehouseId: string
  warehouseName: string
  zoneName?: string
  quantity: number
  unitOfMeasure: string
  minStock: number
  isLowStock: boolean
}

interface Pagination {
  page: number
  limit: number
  total: number
  totalPages: number
}

interface StockLevelsResponse {
  stockLevels: StockLevelItem[]
  pagination: Pagination
}

async function fetchStockLevels(page: number, search: string, warehouseId: string): Promise<StockLevelsResponse> {
  const params = new URLSearchParams({
    page: page.toString(),
    limit: '50',
  })
  if (search) params.append('search', search)
  if (warehouseId) params.append('warehouseId', warehouseId)

  const res = await fetch(`/api/inventory/stock-levels?${params}`)
  if (!res.ok) {
    const error = await res.json()
    throw new Error(error.error || 'Failed to fetch stock levels')
  }
  return res.json()
}

async function fetchWarehouses(): Promise<{ id: string, name: string }[]> {
  const res = await fetch('/api/warehouses')
  if (!res.ok) throw new Error('Failed to fetch warehouses')
  const data = await res.json()
  return data.warehouses || []
}

export function StockLevels() {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [selectedWarehouse, setSelectedWarehouse] = useState<string>('')
  const [isAdjustmentOpen, setIsAdjustmentOpen] = useState(false)
  const [isTransferOpen, setIsTransferOpen] = useState(false)
  const [selectedItem, setSelectedItem] = useState<StockLevelItem | null>(null)
  const debouncedSearch = useDebounce(search, 500)

  const { data: warehouses = [] } = useQuery({
    queryKey: ['warehouses'],
    queryFn: fetchWarehouses,
    staleTime: 10 * 60 * 1000,
  })

  const { data, isLoading, isError, error, refetch, isPlaceholderData } = useQuery<StockLevelsResponse>({
    queryKey: ['stock-levels', page, debouncedSearch, selectedWarehouse],
    queryFn: () => fetchStockLevels(page, debouncedSearch, selectedWarehouse),
    staleTime: 10 * 1000,
    gcTime: 5 * 60 * 1000,
    placeholderData: (prev) => prev,
  })

  const handleAdjustment = (item: StockLevelItem) => {
    setSelectedItem(item)
    setIsAdjustmentOpen(true)
  }

  const handleTransfer = (item: StockLevelItem) => {
    setSelectedItem(item)
    setIsTransferOpen(true)
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-red-50 rounded-xl border border-red-100 animate-in fade-in zoom-in duration-300">
        <AlertTriangle className="h-12 w-12 text-red-500 mb-4" />
        <h3 className="text-lg font-bold text-red-900 mb-2">Error al cargar inventario</h3>
        <p className="text-red-700 mb-6 text-center max-w-md">
          {error instanceof Error ? error.message : 'No se pudo conectar con el servidor.'}
        </p>
        <Button variant="outline" onClick={() => refetch()} className="bg-white hover:bg-red-100 border-red-200">
          Reintentar
        </Button>
      </div>
    )
  }

  if (isLoading && !data) {
    return (
      <div className="space-y-4 animate-in fade-in duration-500">
        <div className="flex gap-4">
          <div className="h-10 bg-gray-200 rounded-md flex-1 animate-pulse" />
          <div className="h-10 bg-gray-200 rounded-md w-48 animate-pulse" />
        </div>
        <div className="border rounded-lg overflow-hidden shadow-sm">
          <div className="h-12 bg-gray-100 border-b" />
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-16 border-b flex items-center px-4 gap-4">
              <div className="h-4 bg-gray-100 rounded w-1/4 animate-pulse" />
              <div className="h-4 bg-gray-100 rounded w-1/6 animate-pulse" />
              <div className="h-4 bg-gray-100 rounded w-1/6 animate-pulse" />
              <div className="h-4 bg-gray-100 rounded w-1/12 animate-pulse" />
              <div className="h-4 bg-gray-100 rounded w-1/12 animate-pulse ml-auto" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  const { stockLevels = [], pagination = { totalPages: 1, page: 1 } } = data || {}

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Buscar por nombre o SKU..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
            className="pl-10"
          />
          {(isLoading || isPlaceholderData) && (
            <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
              <span className="h-4 w-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
            </div>
          )}
        </div>
        <select
          value={selectedWarehouse}
          onChange={(e) => {
            setSelectedWarehouse(e.target.value)
            setPage(1)
          }}
          className="flex h-10 w-48 rounded-md border border-input bg-background px-3 py-2 text-sm focus:ring-2 focus:ring-primary outline-none"
        >
          <option value="">Todos los almacenes</option>
          {warehouses.map((wh) => (
            <option key={wh.id} value={wh.id}>{wh.name}</option>
          ))}
        </select>
      </div>

      <div className="border rounded-lg overflow-hidden shadow-sm bg-white">
        <Table>
          <TableHeader className="bg-gray-50/50">
            <TableRow>
              <TableHead>Producto</TableHead>
              <TableHead>SKU</TableHead>
              <TableHead>Almacén</TableHead>
              <TableHead className="text-right">Stock</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {stockLevels.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-64 text-center">
                  <div className="flex flex-col items-center justify-center text-gray-400">
                    <Search className="h-10 w-10 mb-2 opacity-20" />
                    <p className="text-gray-500 font-medium">No se encontraron productos</p>
                    <p className="text-sm">Prueba ajustando los filtros de búsqueda</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              stockLevels.map((item) => (
                <TableRow key={item.id} className="hover:bg-gray-50/50 transition-colors">
                  <TableCell className="font-medium">
                    {item.productName}
                    {item.zoneName && (
                      <div className="text-[10px] text-gray-400 font-normal uppercase tracking-wider mt-0.5">
                        Zona: {item.zoneName}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-gray-500 font-mono text-xs">{item.productSku}</TableCell>
                  <TableCell className="text-xs text-gray-600">{item.warehouseName}</TableCell>
                  <TableCell className="text-right whitespace-nowrap">
                    <span className={`font-bold ${item.isLowStock ? 'text-orange-600' : 'text-gray-700'}`}>
                      {item.quantity.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                    <span className="text-[10px] text-gray-400 ml-1 uppercase">{item.unitOfMeasure}</span>
                  </TableCell>
                  <TableCell>
                    {item.isLowStock ? (
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-orange-50 text-orange-700 border border-orange-100 text-[11px] font-bold">
                        <AlertTriangle className="h-3 w-3" />
                        BAJO
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-green-50 text-green-700 border border-green-100 text-[11px] font-bold">
                        NORMAL
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleAdjustment(item)}
                        className="h-8 w-8 p-0 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                        title="Ajuste manual"
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleTransfer(item)}
                        className="h-8 w-8 p-0 text-purple-600 hover:text-purple-700 hover:bg-purple-50"
                        title="Transferir entre bodegas"
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
        <div className="flex items-center justify-between pt-2 border-t text-sm">
          <div className="text-gray-500">
            Mostrando pág. <span className="font-medium text-gray-900">{pagination.page}</span> de <span className="font-medium text-gray-900">{pagination.totalPages}</span>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="h-8"
            >
              Anterior
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))}
              disabled={page === pagination.totalPages}
              className="h-8"
            >
              Siguiente
            </Button>
          </div>
        </div>
      )}

      {selectedItem && (
        <>
          <Dialog open={isAdjustmentOpen} onOpenChange={setIsAdjustmentOpen}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Ajuste de Stock</DialogTitle>
              </DialogHeader>
              <StockAdjustmentForm
                item={{
                  warehouseId: selectedItem.warehouseId,
                  warehouseName: selectedItem.warehouseName,
                  productId: selectedItem.productId,
                  productName: selectedItem.productName,
                  productSku: selectedItem.productSku,
                  quantity: selectedItem.quantity,
                  unitOfMeasure: selectedItem.unitOfMeasure
                }}
                onSuccess={() => {
                  setIsAdjustmentOpen(false)
                  setTimeout(() => setSelectedItem(null), 200)
                }}
              />
            </DialogContent>
          </Dialog>

          <Dialog open={isTransferOpen} onOpenChange={setIsTransferOpen}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Transferencia de Inventario</DialogTitle>
              </DialogHeader>
              <StockTransferForm
                item={{
                  warehouseId: selectedItem.warehouseId,
                  warehouseName: selectedItem.warehouseName,
                  productId: selectedItem.productId,
                  productName: selectedItem.productName,
                  productSku: selectedItem.productSku,
                  quantity: selectedItem.quantity,
                  unitOfMeasure: selectedItem.unitOfMeasure
                }}
                warehouses={warehouses}
                onSuccess={() => {
                  setIsTransferOpen(false)
                  setTimeout(() => setSelectedItem(null), 200)
                }}
              />
            </DialogContent>
          </Dialog>
        </>
      )}
    </div>
  )
}

