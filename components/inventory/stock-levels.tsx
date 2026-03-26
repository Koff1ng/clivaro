'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useDebounce } from '@/lib/hooks/use-debounce'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { StockAdjustmentForm } from './adjustment-form'
import { StockTransferForm } from './transfer-form'
import { formatCurrency } from '@/lib/utils'
import { Search, Plus, AlertTriangle, ArrowRightLeft, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Filter, Package } from 'lucide-react'

// Conversion map matching COMMON_UNITS IDs from product form
const UNIT_CONVERSIONS: Record<string, { toUnit: string, toLabel: string, multiplier: number }> = {
  'DOZEN':  { toUnit: 'UNIT', toLabel: 'Unidades', multiplier: 12 },
  'BOX':    { toUnit: 'UNIT', toLabel: 'Unidades', multiplier: 12 },
  'PACK':   { toUnit: 'UNIT', toLabel: 'Unidades', multiplier: 10 },
  'PAIR':   { toUnit: 'UNIT', toLabel: 'Unidades', multiplier: 2 },
  'ROLL':   { toUnit: 'UNIT', toLabel: 'Unidades', multiplier: 1 },
  'KILO':   { toUnit: 'GRAM', toLabel: 'Gramos', multiplier: 1000 },
  'POUND':  { toUnit: 'GRAM', toLabel: 'Gramos', multiplier: 453.592 },
  'LITER':  { toUnit: 'MILLILITER', toLabel: 'Mililitros', multiplier: 1000 },
  'GALLON': { toUnit: 'LITER', toLabel: 'Litros', multiplier: 3.785 },
  'METER':  { toUnit: 'CENTIMETER', toLabel: 'Centímetros', multiplier: 100 },
  'FOOT':   { toUnit: 'INCH', toLabel: 'Pulgadas', multiplier: 12 },
  'YARD':   { toUnit: 'FOOT', toLabel: 'Pies', multiplier: 3 },
  'TON':    { toUnit: 'KILO', toLabel: 'Kilogramos', multiplier: 1000 },
}

const UNIT_LABELS: Record<string, string> = {
  'UNIT': 'Und', 'DOZEN': 'Doc', 'BOX': 'Caja', 'PACK': 'Pqt', 'PAIR': 'Par',
  'KILO': 'Kg', 'GRAM': 'g', 'POUND': 'Lb', 'LITER': 'Lt', 'MILLILITER': 'ml',
  'GALLON': 'Gal', 'METER': 'm', 'CENTIMETER': 'cm', 'FOOT': 'ft', 'YARD': 'yd',
  'TON': 'Ton', 'ROLL': 'Rollo', 'PALLET': 'Pallet',
}

const ITEMS_PER_PAGE_OPTIONS = [10, 25, 50, 100]

function getFractionalDisplay(quantity: number, unitOfMeasure: string): string | null {
  const conv = UNIT_CONVERSIONS[unitOfMeasure]
  if (!conv) return null
  const totalSmall = Math.round(quantity * conv.multiplier)
  const fromLabel = UNIT_LABELS[unitOfMeasure] || unitOfMeasure
  const toLabel = UNIT_LABELS[conv.toUnit] || conv.toLabel
  const wholeUnits = Math.floor(quantity)
  const remainderSmall = totalSmall - (wholeUnits * conv.multiplier)
  if (wholeUnits > 0 && remainderSmall > 0) {
    return `${wholeUnits} ${fromLabel} + ${remainderSmall} ${toLabel}`
  }
  if (totalSmall !== quantity) {
    return `≈ ${totalSmall.toLocaleString()} ${conv.toLabel}`
  }
  return null
}

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
  category?: string
}

interface Pagination {
  page: number
  limit: number
  total: number
  totalPages: number
}

interface StockLevelsResponse {
  stockLevels: StockLevelItem[]
  categories: string[]
  pagination: Pagination
}

async function fetchStockLevels(page: number, search: string, warehouseId: string, category: string, limit: number): Promise<StockLevelsResponse> {
  const params = new URLSearchParams({
    page: page.toString(),
    limit: limit.toString(),
  })
  if (search) params.append('search', search)
  if (warehouseId) params.append('warehouseId', warehouseId)
  if (category) params.append('category', category)

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
  const [itemsPerPage, setItemsPerPage] = useState(25)
  const [search, setSearch] = useState('')
  const [selectedWarehouse, setSelectedWarehouse] = useState<string>('')
  const [selectedCategory, setSelectedCategory] = useState<string>('')
  const [isAdjustmentOpen, setIsAdjustmentOpen] = useState(false)
  const [isTransferOpen, setIsTransferOpen] = useState(false)
  const [selectedItem, setSelectedItem] = useState<StockLevelItem | null>(null)
  const debouncedSearch = useDebounce(search, 400)

  const { data: warehouses = [] } = useQuery({
    queryKey: ['warehouses'],
    queryFn: fetchWarehouses,
    staleTime: 10 * 60 * 1000,
  })

  const { data, isLoading, isError, error, refetch, isPlaceholderData } = useQuery<StockLevelsResponse>({
    queryKey: ['stock-levels', page, debouncedSearch, selectedWarehouse, selectedCategory, itemsPerPage],
    queryFn: () => fetchStockLevels(page, debouncedSearch, selectedWarehouse, selectedCategory, itemsPerPage),
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

  const resetFilters = () => {
    setSearch('')
    setSelectedWarehouse('')
    setSelectedCategory('')
    setPage(1)
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-red-50 dark:bg-red-950/20 rounded-xl border border-red-100 dark:border-red-900/30 animate-in fade-in zoom-in duration-300">
        <AlertTriangle className="h-12 w-12 text-red-500 mb-4" />
        <h3 className="text-lg font-bold text-red-900 dark:text-red-300 mb-2">Error al cargar inventario</h3>
        <p className="text-red-700 dark:text-red-400 mb-6 text-center max-w-md">
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
        <div className="flex gap-3">
          <div className="h-10 bg-gray-200 dark:bg-gray-800 rounded-md flex-1 animate-pulse" />
          <div className="h-10 bg-gray-200 dark:bg-gray-800 rounded-md w-40 animate-pulse" />
          <div className="h-10 bg-gray-200 dark:bg-gray-800 rounded-md w-40 animate-pulse" />
        </div>
        <div className="border rounded-lg overflow-hidden shadow-sm">
          <div className="h-12 bg-gray-100 dark:bg-gray-800 border-b" />
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-16 border-b flex items-center px-4 gap-4">
              <div className="h-4 bg-gray-100 dark:bg-gray-800 rounded w-1/4 animate-pulse" />
              <div className="h-4 bg-gray-100 dark:bg-gray-800 rounded w-1/6 animate-pulse" />
              <div className="h-4 bg-gray-100 dark:bg-gray-800 rounded w-1/6 animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  const { stockLevels = [], categories = [], pagination = { totalPages: 1, page: 1, total: 0, limit: 25 } } = data || {}
  const hasActiveFilters = search || selectedWarehouse || selectedCategory
  const startItem = (pagination.page - 1) * pagination.limit + 1
  const endItem = Math.min(pagination.page * pagination.limit, pagination.total)

  // Generate page numbers
  const getPageNumbers = () => {
    const pages: (number | 'dots')[] = []
    const total = pagination.totalPages
    if (total <= 7) {
      for (let i = 1; i <= total; i++) pages.push(i)
    } else {
      pages.push(1)
      if (page > 3) pages.push('dots')
      for (let i = Math.max(2, page - 1); i <= Math.min(total - 1, page + 1); i++) pages.push(i)
      if (page < total - 2) pages.push('dots')
      pages.push(total)
    }
    return pages
  }

  return (
    <div className="space-y-4">
      {/* Filters bar */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Buscar por nombre, SKU o categoría..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
            className="pl-10 h-10"
          />
          {(isLoading || isPlaceholderData) && (
            <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
              <span className="block h-4 w-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
            </div>
          )}
        </div>

        {/* Category filter */}
        <select
          value={selectedCategory}
          onChange={(e) => {
            setSelectedCategory(e.target.value)
            setPage(1)
          }}
          className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm focus:ring-2 focus:ring-primary outline-none min-w-[160px]"
        >
          <option value="">Todas las categorías</option>
          {categories.map((cat) => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>

        {/* Warehouse filter */}
        <select
          value={selectedWarehouse}
          onChange={(e) => {
            setSelectedWarehouse(e.target.value)
            setPage(1)
          }}
          className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm focus:ring-2 focus:ring-primary outline-none min-w-[160px]"
        >
          <option value="">Todos los almacenes</option>
          {warehouses.map((wh) => (
            <option key={wh.id} value={wh.id}>{wh.name}</option>
          ))}
        </select>

        {/* Items per page */}
        <select
          value={itemsPerPage}
          onChange={(e) => {
            setItemsPerPage(Number(e.target.value))
            setPage(1)
          }}
          className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm focus:ring-2 focus:ring-primary outline-none w-[100px]"
        >
          {ITEMS_PER_PAGE_OPTIONS.map((n) => (
            <option key={n} value={n}>{n} / pág</option>
          ))}
        </select>

        {/* Clear filters */}
        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={resetFilters} className="text-xs text-gray-500 hover:text-gray-700 h-10">
            <Filter className="h-3.5 w-3.5 mr-1" /> Limpiar
          </Button>
        )}
      </div>

      {/* Results info */}
      <div className="flex items-center justify-between text-xs text-gray-500">
        <span>
          {pagination.total > 0
            ? `Mostrando ${startItem}-${endItem} de ${pagination.total.toLocaleString()} productos`
            : 'Sin resultados'}
        </span>
        {hasActiveFilters && (
          <span className="text-blue-600 font-medium">Filtros activos</span>
        )}
      </div>

      {/* Table */}
      <div className="border rounded-lg overflow-hidden shadow-sm bg-white dark:bg-gray-950">
        <Table>
          <TableHeader className="bg-gray-50/80 dark:bg-gray-900/50">
            <TableRow>
              <TableHead>Producto</TableHead>
              <TableHead>SKU</TableHead>
              <TableHead>Categoría</TableHead>
              <TableHead>Unidad</TableHead>
              <TableHead>Almacén</TableHead>
              <TableHead className="text-right">Stock</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {stockLevels.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="h-48 text-center">
                  <div className="flex flex-col items-center justify-center text-gray-400">
                    <Package className="h-10 w-10 mb-2 opacity-20" />
                    <p className="text-gray-500 font-medium">No se encontraron productos</p>
                    <p className="text-sm">Prueba ajustando los filtros de búsqueda</p>
                    {hasActiveFilters && (
                      <Button variant="outline" size="sm" className="mt-3" onClick={resetFilters}>Limpiar filtros</Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              stockLevels.map((item) => (
                <TableRow key={item.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-900/30 transition-colors">
                  <TableCell className="font-medium max-w-[200px] truncate">{item.productName}</TableCell>
                  <TableCell className="text-gray-500 font-mono text-xs">{item.productSku}</TableCell>
                  <TableCell>
                    {(item as any).category ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[11px] font-medium">
                        {(item as any).category}
                      </span>
                    ) : (
                      <span className="text-gray-300 text-xs">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 text-[11px] font-medium">
                      {UNIT_LABELS[item.unitOfMeasure] || item.unitOfMeasure}
                    </span>
                  </TableCell>
                  <TableCell className="text-xs text-gray-600 dark:text-gray-400">{item.warehouseName}</TableCell>
                  <TableCell className="text-right whitespace-nowrap">
                    <span className={`font-bold ${item.isLowStock ? 'text-orange-600' : 'text-gray-700 dark:text-gray-200'}`}>
                      {item.quantity.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                    <span className="text-[10px] text-gray-400 ml-1 uppercase">{UNIT_LABELS[item.unitOfMeasure] || item.unitOfMeasure}</span>
                    {(() => {
                      const breakdown = getFractionalDisplay(item.quantity, item.unitOfMeasure)
                      return breakdown ? (
                        <div className="text-[10px] text-blue-500 font-medium mt-0.5">{breakdown}</div>
                      ) : null
                    })()}
                  </TableCell>
                  <TableCell>
                    {item.minStock <= 0 ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-700 text-[11px] font-medium">
                        No configurado
                      </span>
                    ) : item.isLowStock ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-orange-50 dark:bg-orange-950/30 text-orange-700 dark:text-orange-400 border border-orange-100 dark:border-orange-900/40 text-[11px] font-bold">
                        <AlertTriangle className="h-3 w-3" /> BAJO
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-400 border border-green-100 dark:border-green-900/40 text-[11px] font-bold">
                        NORMAL
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost" size="sm"
                        onClick={() => handleAdjustment(item)}
                        className="h-8 w-8 p-0 text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-950/30"
                        title="Ajuste manual"
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost" size="sm"
                        onClick={() => handleTransfer(item)}
                        className="h-8 w-8 p-0 text-purple-600 hover:text-purple-700 hover:bg-purple-50 dark:hover:bg-purple-950/30"
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

      {/* Pagination bar — always visible */}
      <div className="flex items-center justify-between pt-2 border-t border-gray-100 dark:border-gray-800">
        <div className="text-xs text-gray-500 dark:text-gray-400">
          {pagination.total > 0 && (
            <>{startItem}–{endItem} de <span className="font-semibold text-gray-700 dark:text-gray-200">{pagination.total.toLocaleString()}</span> productos</>
          )}
        </div>

        {pagination.totalPages > 1 && (
          <div className="flex items-center gap-1">
            {/* First */}
            <Button
              variant="outline" size="sm"
              onClick={() => setPage(1)}
              disabled={page === 1}
              className="h-8 w-8 p-0"
              title="Primera página"
            >
              <ChevronsLeft className="h-4 w-4" />
            </Button>
            {/* Prev */}
            <Button
              variant="outline" size="sm"
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="h-8 w-8 p-0"
              title="Página anterior"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>

            {/* Page numbers */}
            {getPageNumbers().map((pNum, idx) =>
              pNum === 'dots' ? (
                <span key={`dots-${idx}`} className="px-1 text-gray-400 text-xs">…</span>
              ) : (
                <Button
                  key={pNum}
                  variant={pNum === page ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setPage(pNum)}
                  className={`h-8 w-8 p-0 text-xs ${pNum === page ? 'pointer-events-none' : ''}`}
                >
                  {pNum}
                </Button>
              )
            )}

            {/* Next */}
            <Button
              variant="outline" size="sm"
              onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))}
              disabled={page === pagination.totalPages}
              className="h-8 w-8 p-0"
              title="Página siguiente"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            {/* Last */}
            <Button
              variant="outline" size="sm"
              onClick={() => setPage(pagination.totalPages)}
              disabled={page === pagination.totalPages}
              className="h-8 w-8 p-0"
              title="Última página"
            >
              <ChevronsRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      {/* Dialogs */}
      {selectedItem && (
        <>
          <Dialog open={isAdjustmentOpen} onOpenChange={setIsAdjustmentOpen}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Ajuste de Stock</DialogTitle>
                <DialogDescription>Ajusta manualmente el inventario del producto seleccionado.</DialogDescription>
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
                <DialogDescription>Transfiere stock entre almacenes para el producto seleccionado.</DialogDescription>
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
