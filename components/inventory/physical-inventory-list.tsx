'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { formatDate } from '@/lib/utils'
import { Plus, Printer, Eye, CheckCircle, XCircle, Clock, FileText, ClipboardList, AlertTriangle, Loader2 } from 'lucide-react'
import { PhysicalInventoryForm } from './physical-inventory-form'
import { PhysicalInventoryDetails } from './physical-inventory-details'
import { PhysicalInventoryPrint } from './physical-inventory-print'
import { PhysicalInventoryCountForm } from './physical-inventory-count-form'
import { useToast } from '@/components/ui/toast'

async function fetchPhysicalInventories(warehouseId?: string) {
  const params = new URLSearchParams()
  if (warehouseId) params.append('warehouseId', warehouseId)
  const res = await fetch(`/api/inventory/physical?${params}`)
  if (!res.ok) throw new Error('Failed to fetch physical inventories')
  return res.json()
}

async function fetchWarehouses() {
  const res = await fetch('/api/warehouses')
  if (!res.ok) throw new Error('Failed to fetch warehouses')
  return res.json()
}

export function PhysicalInventoryList() {
  const [selectedWarehouse, setSelectedWarehouse] = useState<string>('')
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [viewInventory, setViewInventory] = useState<any>(null)
  const [printInventory, setPrintInventory] = useState<any>(null)
  const [countInventory, setCountInventory] = useState<any>(null)
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const { data: warehouses = [] } = useQuery({
    queryKey: ['warehouses'],
    queryFn: fetchWarehouses,
  })

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['physical-inventories', selectedWarehouse],
    queryFn: () => fetchPhysicalInventories(selectedWarehouse || undefined),
  })

  const inventories = data?.inventories || []

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PENDING': return 'bg-gray-100 text-gray-800'
      case 'COUNTING': return 'bg-blue-100 text-blue-800'
      case 'COMPLETED': return 'bg-green-100 text-green-800'
      case 'CANCELLED': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'PENDING': return 'Pendiente'
      case 'COUNTING': return 'En Conteo'
      case 'COMPLETED': return 'Completado'
      case 'CANCELLED': return 'Cancelado'
      default: return status
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'PENDING': return FileText
      case 'COUNTING': return Clock
      case 'COMPLETED': return CheckCircle
      case 'CANCELLED': return XCircle
      default: return FileText
    }
  }

  const handleView = async (inventory: any) => {
    try {
      const res = await fetch(`/api/inventory/physical/${inventory.id}`, {
        credentials: 'include',
      })
      if (!res.ok) throw new Error('Failed to fetch inventory details')
      const data = await res.json()
      setViewInventory(data)
    } catch (error: any) {
      toast(error.message || 'Error al cargar detalles', 'error')
    }
  }

  const handlePrint = async (inventory: any) => {
    try {
      const res = await fetch(`/api/inventory/physical/${inventory.id}`, {
        credentials: 'include',
      })
      if (!res.ok) throw new Error('Failed to fetch inventory details')
      const data = await res.json()
      setPrintInventory(data)
    } catch (error: any) {
      toast(error.message || 'Error al cargar detalles', 'error')
    }
  }

  const handleCount = async (inventory: any) => {
    try {
      const res = await fetch(`/api/inventory/physical/${inventory.id}`, {
        credentials: 'include',
      })
      if (!res.ok) throw new Error('Failed to fetch inventory details')
      const data = await res.json()
      setCountInventory(data)
    } catch (error: any) {
      toast(error.message || 'Error al cargar detalles', 'error')
    }
  }

  return (
    <>
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4 flex-1">
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
          </div>
          <Button onClick={() => setIsFormOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Nuevo Inventario Físico
          </Button>
        </div>

        {isLoading && inventories.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground mr-2" />
            <span className="text-muted-foreground">Cargando inventarios físicos...</span>
          </div>
        ) : (
        <div className="border rounded-lg">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="text-left p-3 text-sm font-medium">Número</th>
                <th className="text-left p-3 text-sm font-medium">Almacén</th>
                <th className="text-left p-3 text-sm font-medium">Estado</th>
                <th className="text-left p-3 text-sm font-medium">Productos</th>
                <th className="text-left p-3 text-sm font-medium">Creado</th>
                <th className="text-left p-3 text-sm font-medium">Creado Por</th>
                <th className="text-right p-3 text-sm font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {inventories.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center p-8 text-gray-500">
                    No hay inventarios físicos
                  </td>
                </tr>
              ) : (
                inventories.map((inventory: any) => {
                  const StatusIcon = getStatusIcon(inventory.status)
                  return (
                    <tr key={inventory.id} className="border-b hover:bg-gray-50">
                      <td className="p-3 font-medium">{inventory.number}</td>
                      <td className="p-3">{inventory.warehouse?.name || '-'}</td>
                      <td className="p-3">
                        <div className="flex flex-col gap-2">
                          <span className={`inline-flex items-center gap-1 px-2 py-1 text-xs rounded ${getStatusColor(inventory.status)}`}>
                            <StatusIcon className="h-3 w-3" />
                            {getStatusLabel(inventory.status)}
                          </span>
                          {inventory.hasDifferences && (
                            <>
                              {inventory.hasPositiveDifferences && (
                                <span className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded bg-orange-100 text-orange-800 font-semibold animate-pulse">
                                  <AlertTriangle className="h-3 w-3" />
                                  ¡Se contaron productos de más!
                                </span>
                              )}
                              {inventory.hasNegativeDifferences && (
                                <span className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded bg-orange-100 text-orange-800 font-semibold animate-pulse">
                                  <AlertTriangle className="h-3 w-3" />
                                  ¡Revisar diferencias!
                                </span>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                      <td className="p-3">{inventory._count?.items || 0}</td>
                      <td className="p-3 text-sm text-gray-600">{formatDate(inventory.createdAt)}</td>
                      <td className="p-3 text-sm text-gray-600">{inventory.createdBy?.name || '-'}</td>
                      <td className="p-3">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleView(inventory)}
                            title="Ver detalles"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                            {inventory.status === 'PENDING' || inventory.status === 'COUNTING' ? (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handlePrint(inventory)}
                                title="Imprimir formato"
                              >
                                <Printer className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleCount(inventory)}
                                title="Ingresar cantidades contadas"
                              >
                                <ClipboardList className="h-4 w-4" />
                              </Button>
                            </>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
        )}
      </div>

      {/* Form Dialog */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent>
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
          <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
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
              <div className="flex justify-between items-center">
                <DialogTitle>Formato de Conteo Físico</DialogTitle>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => window.print()}>
                    <Printer className="h-4 w-4 mr-2" />
                    Imprimir
                  </Button>
                  <Button variant="outline" onClick={() => setPrintInventory(null)}>
                    Cerrar
                  </Button>
                </div>
              </div>
              <PhysicalInventoryPrint inventory={printInventory} />
            </div>
          </DialogContent>
        </Dialog>
      )}

        {/* Count Form Dialog */}
        {countInventory && (
          <Dialog open={!!countInventory} onOpenChange={() => setCountInventory(null)}>
            <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
              <PhysicalInventoryCountForm
                inventory={countInventory}
                onClose={() => {
                  setCountInventory(null)
                  // Refetch to show updated status
                  refetch()
                }}
                onSuccess={() => {
                  setCountInventory(null)
                  // Refetch to show updated status (PENDING -> COUNTING)
                  refetch()
                }}
              />
            </DialogContent>
          </Dialog>
        )}
    </>
  )
}

