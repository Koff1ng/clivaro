'use client'

import { useState, useEffect } from 'react'
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/components/ui/toast'
import { Save, X, CheckCircle } from 'lucide-react'

async function fetchPhysicalInventory(id: string) {
  const res = await fetch(`/api/inventory/physical/${id}`, {
    credentials: 'include',
  })
  if (!res.ok) throw new Error('Failed to fetch physical inventory')
  return res.json()
}

export function PhysicalInventoryCountForm({ 
  inventory, 
  onClose, 
  onSuccess 
}: { 
  inventory: any
  onClose: () => void
  onSuccess: () => void 
}) {
  const [countedQuantities, setCountedQuantities] = useState<Record<string, number | ''>>({})
  const [notes, setNotes] = useState<Record<string, string>>({})
  const { toast } = useToast()
  const queryClient = useQueryClient()

  // Always fetch the latest inventory data to show saved quantities
  const { data: currentInventory, isLoading } = useQuery({
    queryKey: ['physical-inventory', inventory.id],
    queryFn: () => fetchPhysicalInventory(inventory.id),
    initialData: inventory, // Use the passed inventory as initial data
    refetchOnMount: true, // Always refetch when component mounts
  })

  // Initialize counted quantities from the fetched inventory
  useEffect(() => {
    if (currentInventory?.items) {
      const initialQuantities: Record<string, number> = {}
      const initialNotes: Record<string, string> = {}
      
      currentInventory.items.forEach((item: any) => {
        // Always show saved countedQuantity if it exists
        if (item.countedQuantity !== null && item.countedQuantity !== undefined) {
          initialQuantities[item.id] = item.countedQuantity
        }
        if (item.notes) {
          initialNotes[item.id] = item.notes
        }
      })
      
      setCountedQuantities(prev => {
        // Merge with existing to preserve unsaved changes
        const merged = { ...prev }
        Object.keys(initialQuantities).forEach(id => {
          merged[id] = initialQuantities[id]
        })
        return merged
      })
      setNotes(prev => {
        // Merge with existing to preserve unsaved changes
        const merged = { ...prev }
        Object.keys(initialNotes).forEach(id => {
          merged[id] = initialNotes[id]
        })
        return merged
      })
    }
  }, [currentInventory?.items])

  const updateItemMutation = useMutation({
    mutationFn: async ({ itemId, countedQuantity, notes }: { itemId: string; countedQuantity: number; notes?: string }) => {
      const res = await fetch(`/api/inventory/physical/${inventory.id}/items/${itemId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ countedQuantity, notes }),
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Error al actualizar item')
      }
      return res.json()
    },
    onSuccess: async () => {
      // Invalidate all related queries to refresh the UI
      await queryClient.invalidateQueries({ queryKey: ['physical-inventories'] })
      await queryClient.invalidateQueries({ queryKey: ['physical-inventory', inventory.id] })
      // Refetch the current inventory to get updated data with saved quantities
      await queryClient.refetchQueries({ queryKey: ['physical-inventory', inventory.id] })
    },
    onError: (error: any) => {
      toast(error.message || 'Error al actualizar cantidad', 'error')
    },
  })

  const saveAllMutation = useMutation({
    mutationFn: async () => {
      const itemsToSave = currentInventory?.items || inventory.items || []
      const updates = itemsToSave.map((item: any) => {
        const quantity = countedQuantities[item.id]
        const note = notes[item.id] || ''
        
        if (typeof quantity === 'number') {
          return updateItemMutation.mutateAsync({
            itemId: item.id,
            countedQuantity: quantity,
            notes: note,
          })
        }
        return Promise.resolve()
      })

      await Promise.all(updates)
    },
    onSuccess: async () => {
      // Invalidate all related queries to refresh the UI
      await queryClient.invalidateQueries({ queryKey: ['physical-inventories'] })
      await queryClient.invalidateQueries({ queryKey: ['physical-inventory', inventory.id] })
      // Refetch to get updated data with all saved quantities
      await queryClient.refetchQueries({ queryKey: ['physical-inventory', inventory.id] })
      await queryClient.refetchQueries({ queryKey: ['physical-inventories'] })
      toast('Cantidades guardadas exitosamente', 'success')
      onSuccess()
    },
    onError: (error: any) => {
      toast(error.message || 'Error al guardar cantidades', 'error')
    },
  })

  const handleSaveAll = () => {
    saveAllMutation.mutate()
  }

  const handleSaveItem = async (itemId: string) => {
    const quantity = countedQuantities[itemId]
    if (typeof quantity !== 'number' || quantity < 0) {
      toast('La cantidad debe ser mayor o igual a 0', 'error')
      return
    }
    await updateItemMutation.mutateAsync({
      itemId,
      countedQuantity: quantity,
      notes: notes[itemId] || '',
    })
    toast('Cantidad guardada. El estado se actualizó a "En Conteo"', 'success')
  }

  const completeMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/inventory/physical/${inventory.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action: 'complete' }),
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Error al completar inventario')
      }
      return res.json()
    },
    onSuccess: async () => {
      toast('Inventario completado y ajustes aplicados', 'success')
      await queryClient.invalidateQueries({ queryKey: ['physical-inventories'] })
      await queryClient.invalidateQueries({ queryKey: ['physical-inventory', inventory.id] })
      await queryClient.invalidateQueries({ queryKey: ['stock-levels'] })
      await queryClient.invalidateQueries({ queryKey: ['inventory-movements'] })
      onSuccess()
    },
    onError: (error: any) => {
      toast(error.message || 'Error al completar inventario', 'error')
    },
  })

  const handleComplete = async () => {
    // Check if all items have counted quantities
    const itemsToCheck = currentInventory?.items || inventory.items || []
    
    // Check items with quantities in the form (including unsaved)
    const itemsWithCount = itemsToCheck.filter((item: any) => {
      const quantity = countedQuantities[item.id]
      // Check both form state and saved quantity
      return (typeof quantity === 'number' && quantity >= 0) || 
             (item.countedQuantity !== null && item.countedQuantity !== undefined)
    })

    if (itemsWithCount.length === 0) {
      toast('Debes ingresar al menos una cantidad contada antes de completar', 'error')
      return
    }

    // Check if ALL items have been counted
    if (itemsWithCount.length < itemsToCheck.length) {
      const missingCount = itemsToCheck.length - itemsWithCount.length
      toast(`No se puede completar el inventario. Faltan ${missingCount} producto(s) por contar.`, 'error')
      return
    }

    // Verify all items have valid quantities (not empty, not null, >= 0)
    const itemsWithoutValidCount = itemsToCheck.filter((item: any) => {
      const quantity = countedQuantities[item.id]
      const savedQuantity = item.countedQuantity
      const finalQuantity = typeof quantity === 'number' ? quantity : savedQuantity
      return finalQuantity === null || finalQuantity === undefined || finalQuantity < 0
    })

    if (itemsWithoutValidCount.length > 0) {
      toast(`No se puede completar el inventario. Hay ${itemsWithoutValidCount.length} producto(s) con cantidades inválidas.`, 'error')
      return
    }

    // First, save all pending changes
    try {
      const itemsToSave = currentInventory?.items || inventory.items || []
      const updates = itemsToSave.map((item: any) => {
        const quantity = countedQuantities[item.id]
        const note = notes[item.id] || ''
        
        // Only update if there's a quantity in the form that differs from saved
        if (typeof quantity === 'number') {
          // Check if it's different from saved quantity
          if (item.countedQuantity !== quantity || item.notes !== note) {
            return updateItemMutation.mutateAsync({
              itemId: item.id,
              countedQuantity: quantity,
              notes: note,
            })
          }
        }
        return Promise.resolve()
      })

      await Promise.all(updates)
      
      // Refresh inventory data after saving
      await queryClient.refetchQueries({ queryKey: ['physical-inventory', inventory.id] })
      
      // Now complete the inventory
      completeMutation.mutate()
    } catch (error: any) {
      toast(error.message || 'Error al guardar cantidades antes de completar', 'error')
    }
  }

  // Check if all items have counted quantities
  const itemsToCheck = currentInventory?.items || inventory.items || []
  const allItemsCounted = itemsToCheck.every((item: any) => {
    const quantity = countedQuantities[item.id]
    const savedQuantity = item.countedQuantity
    // Check both form state and saved quantity
    const finalQuantity = quantity !== undefined && quantity !== null ? quantity : savedQuantity
    return finalQuantity !== null && finalQuantity !== undefined && finalQuantity >= 0
  })
  const hasCountedItems = itemsToCheck.some((item: any) => {
    const quantity = countedQuantities[item.id]
    const savedQuantity = item.countedQuantity
    const finalQuantity = quantity !== undefined && quantity !== null ? quantity : savedQuantity
    return finalQuantity !== null && finalQuantity !== undefined && finalQuantity >= 0
  })

  if (isLoading) {
    return <div className="p-4">Cargando inventario...</div>
  }

  const displayInventory = currentInventory || inventory

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Ingresar Cantidades Contadas</h3>
          <p className="text-sm text-gray-600">
            {displayInventory.number} - {displayInventory.warehouse?.name}
          </p>
        </div>
        <Button variant="outline" onClick={onClose}>
          <X className="h-4 w-4 mr-2" />
          Cerrar
        </Button>
      </div>

      <div className="border rounded-lg max-h-[60vh] overflow-y-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 sticky top-0">
            <tr>
              <th className="text-left p-3 border-b">Producto</th>
              <th className="text-right p-3 border-b">Stock Sistema</th>
              <th className="text-right p-3 border-b">Cantidad Contada</th>
              <th className="text-right p-3 border-b">Diferencia</th>
              <th className="text-left p-3 border-b">Observaciones</th>
              <th className="text-center p-3 border-b">Acción</th>
            </tr>
          </thead>
          <tbody>
            {displayInventory.items?.map((item: any) => {
              const currentCount = countedQuantities[item.id] ?? item.countedQuantity ?? ''
              const numericCount = currentCount === '' ? null : Number(currentCount)
              const difference =
                numericCount != null && !Number.isNaN(numericCount)
                  ? numericCount - item.systemQuantity
                  : null

              return (
                <tr key={item.id} className="border-b hover:bg-gray-50">
                  <td className="p-3">
                    <div>
                      <div className="font-medium">{item.product?.name || '-'}</div>
                      <div className="text-xs text-gray-500">
                        SKU: {item.product?.sku || '-'}
                        {item.variant && ` | Variante: ${item.variant.name}`}
                      </div>
                    </div>
                  </td>
                  <td className="p-3 text-right">
                    <span className="text-gray-600">
                      {item.systemQuantity.toFixed(2)} {item.product?.unitOfMeasure || ''}
                    </span>
                  </td>
                  <td className="p-3">
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={currentCount}
                      onChange={(e) => setCountedQuantities({
                        ...countedQuantities,
                        [item.id]: e.target.value === '' ? '' : parseFloat(e.target.value) || 0,
                      })}
                      placeholder="0.00"
                      className="w-24 text-right"
                    />
                  </td>
                  <td className="p-3 text-right">
                    {difference !== null ? (
                      <span className={`font-semibold ${difference > 0 ? 'text-green-600' : difference < 0 ? 'text-red-600' : 'text-gray-600'}`}>
                        {difference > 0 ? '+' : ''}{difference.toFixed(2)}
                      </span>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </td>
                  <td className="p-3">
                    <Input
                      type="text"
                      value={notes[item.id] || ''}
                      onChange={(e) => setNotes({
                        ...notes,
                        [item.id]: e.target.value,
                      })}
                      placeholder="Observaciones..."
                      className="w-full"
                    />
                  </td>
                  <td className="p-3">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleSaveItem(item.id)}
                      disabled={updateItemMutation.isPending || currentCount === ''}
                    >
                      <Save className="h-3 w-3 mr-1" />
                      Guardar
                    </Button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="flex justify-between items-center pt-4 border-t">
        <div className="text-sm text-gray-600">
          Total productos: {displayInventory.items?.length || 0} | 
          Contados: {itemsToCheck.filter((item: any) => {
            const quantity = countedQuantities[item.id]
            const savedQuantity = item.countedQuantity
            const finalQuantity = quantity !== undefined && quantity !== null ? quantity : savedQuantity
            return finalQuantity !== null && finalQuantity !== undefined && finalQuantity >= 0
          }).length}
          {allItemsCounted ? (
            <span className="ml-2 text-green-600 font-semibold">✓ Todos contados</span>
          ) : (
            <span className="ml-2 text-orange-600 font-semibold">
              ⚠ Faltan {itemsToCheck.length - itemsToCheck.filter((item: any) => {
                const quantity = countedQuantities[item.id]
                const savedQuantity = item.countedQuantity
                const finalQuantity = quantity !== undefined && quantity !== null ? quantity : savedQuantity
                return finalQuantity !== null && finalQuantity !== undefined && finalQuantity >= 0
              }).length} por contar
            </span>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          {(displayInventory.status === 'COUNTING' || displayInventory.status === 'PENDING') && (
            <Button 
              onClick={handleComplete}
              disabled={completeMutation.isPending || !allItemsCounted}
              className="bg-green-600 hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed disabled:hover:bg-gray-400"
              title={!allItemsCounted ? `Debes contar todos los productos antes de completar. Faltan ${itemsToCheck.length - itemsToCheck.filter((item: any) => {
                const quantity = countedQuantities[item.id]
                const savedQuantity = item.countedQuantity
                const finalQuantity = quantity !== undefined && quantity !== null ? quantity : savedQuantity
                return finalQuantity !== null && finalQuantity !== undefined && finalQuantity >= 0
              }).length} producto(s).` : 'Completar inventario y aplicar ajustes'}
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              {completeMutation.isPending ? 'Completando...' : 'Completar Inventario'}
            </Button>
          )}
          <Button 
            onClick={handleSaveAll}
            disabled={saveAllMutation.isPending}
          >
            {saveAllMutation.isPending ? 'Guardando...' : 'Guardar Todo'}
          </Button>
        </div>
      </div>
    </div>
  )
}

