'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Search } from 'lucide-react'

async function fetchWarehouses() {
  const res = await fetch('/api/warehouses')
  if (!res.ok) throw new Error('Failed to fetch warehouses')
  return res.json()
}

async function fetchSuggestions(warehouseId: string, q: string) {
  const params = new URLSearchParams()
  if (warehouseId) params.append('warehouseId', warehouseId)
  if (q) params.append('q', q)
  const res = await fetch(`/api/inventory/reorder-suggestions?${params}`)
  if (!res.ok) throw new Error('Failed to fetch reorder suggestions')
  return res.json()
}

export function ReorderSuggestions() {
  const [selectedWarehouse, setSelectedWarehouse] = useState('')
  const [q, setQ] = useState('')

  const { data: warehouses = [] } = useQuery({
    queryKey: ['warehouses'],
    queryFn: fetchWarehouses,
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  })

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['reorder-suggestions', selectedWarehouse, q],
    queryFn: () => fetchSuggestions(selectedWarehouse, q),
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000,
  })

  const suggestions = data?.suggestions || []

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4 flex-wrap">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar producto..."
            className="pl-9 w-72"
          />
        </div>
        <select
          value={selectedWarehouse}
          onChange={(e) => setSelectedWarehouse(e.target.value)}
          className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          <option value="">Todos los almacenes</option>
          {warehouses.map((wh: any) => (
            <option key={wh.id} value={wh.id}>{wh.name}</option>
          ))}
        </select>
        <Button variant="outline" onClick={() => refetch()}>
          Actualizar
        </Button>
      </div>

      {isLoading ? (
        <div className="text-sm text-muted-foreground">Cargando sugerencias…</div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Producto</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead>Almacén</TableHead>
                <TableHead className="text-right">Stock</TableHead>
                <TableHead className="text-right">Mín</TableHead>
                <TableHead className="text-right">Máx</TableHead>
                <TableHead className="text-right">Sugerido</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {suggestions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-gray-500">
                    No hay sugerencias (configura mínimos/máximos)
                  </TableCell>
                </TableRow>
              ) : (
                suggestions.map((s: any) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{s.productName}</TableCell>
                    <TableCell>{s.productSku}</TableCell>
                    <TableCell>{s.warehouseName}</TableCell>
                    <TableCell className="text-right">{Number(s.quantity).toFixed(2)}</TableCell>
                    <TableCell className="text-right">{Number(s.minStock).toFixed(2)}</TableCell>
                    <TableCell className="text-right">{Number(s.maxStock).toFixed(2)}</TableCell>
                    <TableCell className="text-right font-bold text-orange-600">{Number(s.suggestedQty).toFixed(2)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}


