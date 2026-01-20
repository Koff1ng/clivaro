'use client'

import React, { useState, useMemo, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { DatePicker } from '@/components/ui/date-picker'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatCurrency, formatDateTime } from '@/lib/utils'
import { Search, Filter, Loader2 } from 'lucide-react'

async function fetchMovements(page: number, warehouseId: string, type: string, createdById: string, startDate: string, endDate: string, q: string) {
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
  if (!res.ok) throw new Error('Failed to fetch movements')
  return res.json()
}

async function fetchWarehouses() {
  const res = await fetch('/api/warehouses')
  if (!res.ok) throw new Error('Failed to fetch warehouses')
  return res.json()
}

async function fetchUsers(q?: string) {
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

  const { data: warehouses = [] } = useQuery({
    queryKey: ['warehouses'],
    queryFn: fetchWarehouses,
    staleTime: 10 * 60 * 1000, // 10 minutes
    gcTime: 30 * 60 * 1000,
  })
  
  const { data: users = [] } = useQuery({
    queryKey: ['users-minimal'],
    queryFn: () => fetchUsers(),
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  })

  const { data, isLoading } = useQuery({
    queryKey: ['inventory-movements', page, selectedWarehouse, selectedType, selectedUser, startDate, endDate, search],
    queryFn: () => fetchMovements(page, selectedWarehouse, selectedType, selectedUser, startDate, endDate, search),
    staleTime: 10 * 1000, // 10 segundos - datos considerados frescos
    refetchInterval: 30 * 1000, // Refrescar cada 30 segundos (optimizado para mejor rendimiento)
    refetchOnWindowFocus: true, // Refrescar cuando la ventana recupera el foco
    gcTime: 5 * 60 * 1000,
    placeholderData: (prev) => prev,
  })

  const { movements, pagination } = useMemo(() => {
    return data || { movements: [], pagination: { totalPages: 1 } }
  }, [data])

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'IN': return 'text-green-600'
      case 'OUT': return 'text-red-600'
      case 'TRANSFER': return 'text-blue-600'
      default: return 'text-gray-600'
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

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4 flex-wrap">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
            placeholder="Buscar por motivo, referencia, producto..."
            className="pl-9 w-72"
          />
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
        <select
          value={selectedType}
          onChange={(e) => {
            setSelectedType(e.target.value)
            setPage(1)
          }}
          className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          <option value="">Todos los tipos</option>
          <option value="IN">Entrada</option>
          <option value="OUT">Salida</option>
          <option value="TRANSFER">Transferencia</option>
        </select>
        <select
          value={selectedUser}
          onChange={(e) => {
            setSelectedUser(e.target.value)
            setPage(1)
          }}
          className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          <option value="">Todos los usuarios</option>
          {users.map((u: any) => (
            <option key={u.id} value={u.id}>{u.name}</option>
          ))}
        </select>
        <DatePicker
          value={startDate || null}
          onChange={(value) => {
            setStartDate(value || '')
            setPage(1)
          }}
          placeholder="Desde"
          className="w-40"
        />
        <DatePicker
          value={endDate || null}
          onChange={(value) => {
            setEndDate(value || '')
            setPage(1)
          }}
          placeholder="Hasta"
          className="w-40"
        />
        {(startDate || endDate || selectedType || selectedWarehouse || selectedUser || search) && (
          <Button
            variant="outline"
            onClick={() => {
              setStartDate('')
              setEndDate('')
              setSelectedType('')
              setSelectedWarehouse('')
              setSelectedUser('')
              setSearch('')
              setPage(1)
            }}
          >
            Limpiar
          </Button>
        )}
      </div>

      {isLoading && movements.length === 0 ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground mr-2" />
          <span className="text-muted-foreground">Cargando movimientos...</span>
        </div>
      ) : (
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fecha</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Producto</TableHead>
              <TableHead>Almacén</TableHead>
              <TableHead>Cantidad</TableHead>
              <TableHead>Costo</TableHead>
              <TableHead>Referencia</TableHead>
              <TableHead>Razón</TableHead>
              <TableHead>Usuario</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {movements.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center text-gray-500">
                  No hay movimientos
                </TableCell>
              </TableRow>
            ) : (
              movements.map((movement: any) => (
                <TableRow key={movement.id}>
                  <TableCell>{formatDateTime(movement.createdAt)}</TableCell>
                  <TableCell>
                    <span className={getTypeColor(movement.type)}>
                      {getTypeLabel(movement.type)}
                    </span>
                  </TableCell>
                  <TableCell>{movement.productName} ({movement.productSku})</TableCell>
                  <TableCell>{movement.warehouseName}</TableCell>
                  <TableCell>{movement.quantity.toFixed(2)}</TableCell>
                  <TableCell>
                    {movement.cost ? formatCurrency(movement.cost) : '-'}
                  </TableCell>
                  <TableCell>{movement.reference || '-'}</TableCell>
                  <TableCell>{movement.reason || '-'}</TableCell>
                  <TableCell>{movement.createdByName}</TableCell>
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
    </div>
  )
}

