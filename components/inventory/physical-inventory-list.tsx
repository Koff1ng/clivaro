'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useDebounce } from '@/lib/hooks/use-debounce'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { formatDate } from '@/lib/utils'
import { Plus, Printer, Eye, CheckCircle, XCircle, Clock, FileText, ClipboardList, AlertTriangle, Loader2, Search } from 'lucide-react'
import { PhysicalInventoryForm } from './physical-inventory-form'
import { PhysicalInventoryDetails } from './physical-inventory-details'
import { PhysicalInventoryPrint } from './physical-inventory-print'
import { PhysicalInventoryCountForm } from './physical-inventory-count-form'
import { useToast } from '@/components/ui/toast'

interface PhysicalInventoryItem {
  id: string
  number: string
  status: 'PENDING' | 'COUNTING' | 'COMPLETED' | 'CANCELLED'
  createdAt: string
  warehouse?: { id: string, name: string }
  createdBy?: { id: string, name: string }
  _count?: { items: number }
  hasDifferences?: boolean
  hasPositiveDifferences?: boolean
  hasNegativeDifferences?: boolean
}

async function fetchPhysicalInventories(warehouseId?: string, q?: string): Promise<{ inventories: PhysicalInventoryItem[] }> {
  const params = new URLSearchParams()
  if (warehouseId) params.append('warehouseId', warehouseId)
  if (q) params.append('q', q)
  const res = await fetch(`/api/inventory/physical?${params}`)
  if (!res.ok) {
    const error = await res.json()
    throw new Error(error.error || 'Failed to fetch physical inventories')
  }
  return res.json()
}

async function fetchWarehouses(): Promise<{ id: string, name: string }[]> {
  const res = await fetch('/api/warehouses')
  if (!res.ok) throw new Error('Failed to fetch warehouses')
  const data = await res.json()
  return data.warehouses || []
}

export function PhysicalInventoryList() {
  const [selectedWarehouse, setSelectedWarehouse] = useState<string>('')
  const [q, setQ] = useState('')
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [viewInventory, setViewInventory] = useState<any>(null)
  const [printInventory, setPrintInventory] = useState<any>(null)
  const [countInventory, setCountInventory] = useState<any>(null)
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const debouncedSearch = useDebounce(q, 500)

  const { data: warehouses = [] } = useQuery({
    queryKey: ['warehouses'],
    queryFn: fetchWarehouses,
  })

  const { data, isLoading, isError, error, refetch, isPlaceholderData } = useQuery<{ inventories: PhysicalInventoryItem[] }>({
    queryKey: ['physical-inventories', selectedWarehouse, debouncedSearch],
    queryFn: () => fetchPhysicalInventories(selectedWarehouse || undefined, debouncedSearch),
    placeholderData: (prev) => prev,
  })

  const inventories = data?.inventories || []

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'PENDING': return { color: 'bg-gray-100 text-gray-800 border-gray-200', label: 'Pendiente', icon: FileText }
      case 'COUNTING': return { color: 'bg-blue-100 text-blue-800 border-blue-200', label: 'En Conteo', icon: Clock }
      case 'COMPLETED': return { color: 'bg-green-100 text-green-800 border-green-200', label: 'Completado', icon: CheckCircle }
      case 'CANCELLED': return { color: 'bg-red-100 text-red-800 border-red-200', label: 'Cancelado', icon: XCircle }
      default: return { color: 'bg-gray-100 text-gray-800 border-gray-200', label: status, icon: FileText }
    }
  }

  const handleAction = async (inventoryId: string, action: 'view' | 'print' | 'count') => {
    try {
      const res = await fetch(`/api/inventory/physical/${inventoryId}`)
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || error.details || 'Error al cargar detalles')
      }
      const data = await res.json()

      if (action === 'view') setViewInventory(data)
      else if (action === 'print') setPrintInventory(data)
      else if (action === 'count') setCountInventory(data)
    } catch (error: any) {
      toast(error.message, 'error')
    }
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-red-50 rounded-xl border border-red-100 animate-in fade-in zoom-in duration-300">
        <AlertTriangle className="h-12 w-12 text-red-500 mb-4" />
        <h3 className="text-lg font-bold text-red-900 mb-2">Error al cargar inventarios</h3>
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
    <>
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3 flex-1 min-w-[300px]">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Buscar por número o nota..."
                className="pl-9"
              />
              {(isLoading || isPlaceholderData) && (
                <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                </div>
              )}
            </div>
            <select
              value={selectedWarehouse}
              onChange={(e) => setSelectedWarehouse(e.target.value)}
              className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/20"
            >
              <option value="">Todos los almacenes</option>
              {warehouses.map((wh: any) => (
                <option key={wh.id} value={wh.id}>{wh.name}</option>
              ))}
            </select>
          </div>
          <Button onClick={() => setIsFormOpen(true)} className="shadow-sm">
            <Plus className="h-4 w-4 mr-2" />
            Nuevo Inventario
          </Button>
        </div>

        <div className="border rounded-lg overflow-hidden shadow-sm bg-white">
          <table className="w-full">
            <thead className="bg-gray-50/50 border-b">
              <tr>
                <th className="text-left p-4 text-xs font-bold uppercase text-gray-500 tracking-wider">Número</th>
                <th className="text-left p-4 text-xs font-bold uppercase text-gray-500 tracking-wider">Origen</th>
                <th className="text-left p-4 text-xs font-bold uppercase text-gray-500 tracking-wider">Estado</th>
                <th className="text-left p-4 text-xs font-bold uppercase text-gray-500 tracking-wider">Ítems</th>
                <th className="text-left p-4 text-xs font-bold uppercase text-gray-500 tracking-wider">Fecha Creación</th>
                <th className="text-right p-4 text-xs font-bold uppercase text-gray-500 tracking-wider">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading && !data ? (
                [...Array(3)].map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td colSpan={6} className="p-4"><div className="h-8 bg-gray-50 rounded" /></td>
                  </tr>
                ))
              ) : inventories.length === 0 ? (
                <tr>
                  <td colSpan={6} className="h-64 text-center">
                    <div className="flex flex-col items-center justify-center text-gray-400">
                      <ClipboardList className="h-12 w-12 mb-3 opacity-20" />
                      <p className="text-gray-500 font-medium text-lg">No hay inventarios físicos</p>
                      <p className="text-sm">Inicia un nuevo conteo para regularizar existencias.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                inventories.map((inventory) => {
                  const config = getStatusConfig(inventory.status)
                  const StatusIcon = config.icon
                  return (
                    <tr key={inventory.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="p-4 font-bold text-gray-900">{inventory.number}</td>
                      <td className="p-4 text-sm text-gray-600">{inventory.warehouse?.name || '-'}</td>
                      <td className="p-4">
                        <div className="flex flex-col gap-1.5 items-start">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-tight border ${config.color}`}>
                            <StatusIcon className="h-3.3 w-3.5" />
                            {config.label}
                          </span>
                          {inventory.hasDifferences && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] bg-orange-50 text-orange-700 font-bold border border-orange-200 animate-pulse">
                              <AlertTriangle className="h-2.5 w-2.5" />
                              DIFERENCIAS DETECTADAS
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="p-4 text-sm font-medium">{inventory._count?.items || 0}</td>
                      <td className="p-4">
                        <div className="text-sm text-gray-700">{formatDate(inventory.createdAt)}</div>
                        <div className="text-[10px] text-gray-400">Por: {inventory.createdBy?.name || '-'}</div>
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleAction(inventory.id, 'view')}
                            className="h-8 w-8 p-0 text-gray-500 hover:text-primary hover:bg-gray-100"
                            title="Ver detalles"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          {(inventory.status === 'PENDING' || inventory.status === 'COUNTING') && (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleAction(inventory.id, 'print')}
                                className="h-8 w-8 p-0 text-gray-500 hover:text-primary hover:bg-gray-100"
                                title="Imprimir formato"
                              >
                                <Printer className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleAction(inventory.id, 'count')}
                                className="h-8 w-8 p-0 text-orange-600 hover:text-orange-700 hover:bg-orange-50"
                                title="Ingresar conteo"
                              >
                                <ClipboardList className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Form Dialog */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nuevo Inventario Físico</DialogTitle>
          </DialogHeader>
          <PhysicalInventoryForm
            warehouses={warehouses}
            onSuccess={() => {
              setIsFormOpen(false)
              refetch()
            }}
          />
        </DialogContent>
      </Dialog>

      {/* Details Dialog */}
      {viewInventory && (
        <Dialog open={!!viewInventory} onOpenChange={() => setViewInventory(null)}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col p-0">
            <PhysicalInventoryDetails
              inventory={viewInventory}
              onClose={() => setViewInventory(null)}
              onUpdate={refetch}
            />
          </DialogContent>
        </Dialog>
      )}

      {/* Print View */}
      {printInventory && (
        <Dialog open={!!printInventory} onOpenChange={() => setPrintInventory(null)}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="space-y-4">
              <div className="flex justify-between items-center bg-gray-50 p-4 rounded-lg sticky top-0 z-10">
                <div className="flex items-center gap-2">
                  <Printer className="h-5 w-5 text-gray-500" />
                  <DialogTitle className="text-lg">Formato de Conteo Físico</DialogTitle>
                </div>
                <div className="flex gap-2">
                  <Button onClick={() => window.print()} className="bg-primary shadow-sm hover:translate-y-[-1px] transition-transform">
                    <Printer className="h-4 w-4 mr-2" />
                    Imprimir Ahora
                  </Button>
                  <Button variant="outline" onClick={() => setPrintInventory(null)}>
                    Cerrar
                  </Button>
                </div>
              </div>
              <div className="p-4 border border-dashed rounded-lg bg-white">
                <PhysicalInventoryPrint inventory={printInventory} />
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Count Form Dialog */}
      {countInventory && (
        <Dialog open={!!countInventory} onOpenChange={() => setCountInventory(null)}>
          <DialogContent className="max-w-5xl max-h-[95vh] overflow-hidden flex flex-col p-0">
            <PhysicalInventoryCountForm
              inventory={countInventory}
              onClose={() => {
                setCountInventory(null)
                refetch()
              }}
              onSuccess={() => {
                setCountInventory(null)
                refetch()
              }}
            />
          </DialogContent>
        </Dialog>
      )}
    </>
  )
}

