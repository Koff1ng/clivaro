'use client'

import React, { useState, useMemo, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useDebounce } from '@/lib/hooks/use-debounce'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { DatePicker } from '@/components/ui/date-picker'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatCurrency, formatDateTime } from '@/lib/utils'
import { Search, Filter, Loader2, AlertTriangle } from 'lucide-react'

interface MovementItem {
  id: string
  createdAt: string
  type: 'IN' | 'OUT' | 'TRANSFER'
  productId: string
  productName: string
  productSku: string
  warehouseId: string
  warehouseName: string
  quantity: number
  cost?: number
  reference?: string
  reason?: string
  reasonCode?: string
  reasonNote?: string
  createdByName: string
}

interface Pagination {
  page: number
  limit: number
  total: number
  totalPages: number
}

interface MovementsResponse {
  movements: MovementItem[]
  pagination: Pagination
}

async function fetchMovements(
  page: number,
  warehouseId: string,
  type: string,
  createdById: string,
  startDate: string,
  endDate: string,
  q: string
): Promise<MovementsResponse> {
  const params = new URLSearchParams({
    page: page.toString(),
    limit: '50',
  })
  if (warehouseId) params.append('warehouseId', warehouseId)
  if (type) params.append('type', type)
  if (createdById) params.append('createdById', createdById)
  if (startDate) params.append('startDate', startDate)
  if (endDate) params.append('endDate', endDate)
  if (q) params.append('q', q)

  const res = await fetch(`/api/inventory/movements?${params}`)
  if (!res.ok) {
    const error = await res.json()
    throw new Error(error.error || 'Failed to fetch movements')
  }
  return res.json()
}

async function fetchWarehouses(): Promise<{ id: string, name: string }[]> {
  const res = await fetch('/api/warehouses')
  if (!res.ok) throw new Error('Failed to fetch warehouses')
  const data = await res.json()
  return data.warehouses || []
}

async function fetchUsers(q?: string): Promise<{ id: string, name: string }[]> {
  const params = new URLSearchParams()
  if (q) params.append('q', q)
  const res = await fetch(`/api/users?${params}`)
  if (!res.ok) return []
  const data = await res.json()
  return data.users || []
}

export function MovementsList() {
  const [page, setPage] = useState(1)
  const [selectedWarehouse, setSelectedWarehouse] = useState<string>('')
  const [selectedType, setSelectedType] = useState<string>('')
  const [selectedUser, setSelectedUser] = useState<string>('')
  const [search, setSearch] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const debouncedSearch = useDebounce(search, 500)

  const { data: warehouses = [] } = useQuery({
    queryKey: ['warehouses'],
    queryFn: fetchWarehouses,
    staleTime: 10 * 60 * 1000,
  })

  const { data: users = [] } = useQuery({
    queryKey: ['users-minimal'],
    queryFn: () => fetchUsers(),
    staleTime: 10 * 60 * 1000,
  })

  const { data, isLoading, isError, error, refetch, isPlaceholderData } = useQuery<MovementsResponse>({
    queryKey: ['inventory-movements', page, selectedWarehouse, selectedType, selectedUser, startDate, endDate, debouncedSearch],
    queryFn: () => fetchMovements(page, selectedWarehouse, selectedType, selectedUser, startDate, endDate, debouncedSearch),
    staleTime: 10 * 1000,
    placeholderData: (prev) => prev,
  })

  const { movements = [], pagination = { totalPages: 1, page: 1 } } = data || {}

  const getTypeStyles = (type: string) => {
    switch (type) {
      case 'IN': return 'bg-green-50 text-green-700 border-green-100'
      case 'OUT': return 'bg-red-50 text-red-700 border-red-100'
      case 'TRANSFER': return 'bg-blue-50 text-blue-700 border-blue-100'
      default: return 'bg-gray-50 text-gray-700 border-gray-100'
    }
  }

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'IN': return 'Entrada'
      case 'OUT': return 'Salida'
      case 'TRANSFER': return 'Transferencia'
      default: return type
    }
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-red-50 rounded-xl border border-red-100 animate-in fade-in zoom-in duration-300">
        <AlertTriangle className="h-12 w-12 text-red-500 mb-4" />
        <h3 className="text-lg font-bold text-red-900 mb-2">Error al cargar movimientos</h3>
        <p className="text-red-700 mb-6 text-center max-w-md">
          {error instanceof Error ? error.message : 'No se pudo conectar con el servidor.'}
        </p>
        <Button variant="outline" onClick={() => refetch()} className="bg-white hover:bg-red-100 border-red-200">
          Reintentar
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap bg-gray-50/50 p-4 rounded-lg border border-gray-100 shadow-sm">
        <div className="relative flex-1 min-w-[280px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
            placeholder="Buscar por motivo, referencia, producto..."
            className="pl-9 w-full bg-white"
          />
          {(isLoading || isPlaceholderData) && (
            <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
            </div>
          )}
        </div>

        <select
          value={selectedWarehouse}
          onChange={(e) => {
            setSelectedWarehouse(e.target.value)
            setPage(1)
          }}
          className="h-10 rounded-md border border-input bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/20"
        >
          <option value="">Todos los almacenes</option>
          {warehouses.map((wh) => (
            <option key={wh.id} value={wh.id}>{wh.name}</option>
          ))}
        </select>

        <select
          value={selectedType}
          onChange={(e) => {
            setSelectedType(e.target.value)
            setPage(1)
          }}
          className="h-10 rounded-md border border-input bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/20"
        >
          <option value="">Todos los tipos</option>
          <option value="IN">Entradas (+)</option>
          <option value="OUT">Salidas (-)</option>
          <option value="TRANSFER">Transferencias</option>
        </select>

        <div className="flex gap-2">
          <DatePicker
            value={startDate || null}
            onChange={(value) => {
              setStartDate(value || '')
              setPage(1)
            }}
            placeholder="Desde"
            className="w-36 bg-white"
          />
          <DatePicker
            value={endDate || null}
            onChange={(value) => {
              setEndDate(value || '')
              setPage(1)
            }}
            placeholder="Hasta"
            className="w-36 bg-white"
          />
        </div>

        {(startDate || endDate || selectedType || selectedWarehouse || selectedUser || search) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setStartDate('')
              setEndDate('')
              setSelectedType('')
              setSelectedWarehouse('')
              setSelectedUser('')
              setSearch('')
              setPage(1)
            }}
            className="text-gray-500 hover:text-red-600 h-10 px-3"
          >
            Limpiar Filtros
          </Button>
        )}
      </div>

      <div className="border rounded-lg overflow-hidden shadow-sm bg-white">
        <Table>
          <TableHeader className="bg-gray-50/50">
            <TableRow>
              <TableHead className="w-[180px]">Fecha / Hora</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Producto</TableHead>
              <TableHead>Almacén</TableHead>
              <TableHead className="text-right">Cantidad</TableHead>
              <TableHead>Referencia / Motivo</TableHead>
              <TableHead>Usuario</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && movements.length === 0 ? (
              [...Array(5)].map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={7} className="h-16 px-4">
                    <div className="h-4 bg-gray-100 rounded animate-pulse" />
                  </TableCell>
                </TableRow>
              ))
            ) : movements.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-64 text-center">
                  <div className="flex flex-col items-center justify-center text-gray-400">
                    <Filter className="h-10 w-10 mb-2 opacity-20" />
                    <p className="text-gray-500 font-medium">No se encontraron movimientos</p>
                    <p className="text-sm">Prueba ajustando los filtros de búsqueda</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              movements.map((movement) => (
                <TableRow key={movement.id} className="hover:bg-gray-50/50 transition-colors">
                  <TableCell className="text-xs font-mono text-gray-500">
                    {formatDateTime(movement.createdAt)}
                  </TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-[10px] font-bold uppercase tracking-wider ${getTypeStyles(movement.type)}`}>
                      {getTypeLabel(movement.type)}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="font-medium text-sm">{movement.productName}</div>
                    <div className="text-[10px] text-gray-400 font-mono">{movement.productSku}</div>
                  </TableCell>
                  <TableCell className="text-xs text-gray-600">{movement.warehouseName}</TableCell>
                  <TableCell className="text-right font-bold tabular-nums">
                    <span className={movement.type === 'IN' ? 'text-green-600' : movement.type === 'OUT' ? 'text-red-600' : 'text-blue-600'}>
                      {movement.type === 'IN' ? '+' : movement.type === 'OUT' ? '-' : ''}
                      {movement.quantity.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="text-xs font-medium text-gray-700">{movement.reason || '-'}</div>
                    <div className="flex gap-2 mt-0.5">
                      {movement.reasonCode && (
                        <span className="text-[9px] font-black text-blue-600/70 border border-blue-200/50 bg-blue-50/30 px-1 rounded uppercase">
                          {movement.reasonCode}
                        </span>
                      )}
                      {movement.reference && (
                        <span className="text-[9px] text-gray-400 font-mono">
                          Ref: {movement.reference}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-xs text-gray-500">{movement.createdByName}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <div className="text-xs text-gray-500">
            Página <span className="font-bold text-gray-900">{pagination.page}</span> de <span className="font-bold text-gray-900">{pagination.totalPages}</span>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="h-8 shadow-sm"
            >
              Anterior
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))}
              disabled={page === pagination.totalPages}
              className="h-8 shadow-sm"
            >
              Siguiente
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

