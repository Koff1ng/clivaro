'use client'

import { useState, useEffect } from 'react'
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/components/ui/toast'
import { Save, X, CheckCircle, Loader2, AlertTriangle } from 'lucide-react'

interface PhysicalInventoryItemDetails {
  id: string
  number: string
  status: 'PENDING' | 'COUNTING' | 'COMPLETED' | 'CANCELLED'
  warehouse: { id: string, name: string }
  items: Array<{
    id: string
    systemQuantity: number
    countedQuantity: number | null
    notes: string | null
    product: {
      name: string
      sku: string
      unitOfMeasure: string
    }
    variant?: {
      name: string
    }
  }>
}

async function fetchPhysicalInventory(id: string): Promise<PhysicalInventoryItemDetails> {
  const res = await fetch(`/api/inventory/physical/${id}`)
  if (!res.ok) {
    const error = await res.json()
    throw new Error(error.error || 'Failed to fetch physical inventory')
  }
  return res.json()
}

export function PhysicalInventoryCountForm({
  inventory,
  onClose,
  onSuccess
}: {
  inventory: { id: string, number: string, warehouse?: { name: string } }
  onClose: () => void
  onSuccess: () => void
}) {
  const [countedQuantities, setCountedQuantities] = useState<Record<string, number | ''>>({})
  const [notes, setNotes] = useState<Record<string, string>>({})
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const { data: currentInventory, isLoading, isError, error } = useQuery<PhysicalInventoryItemDetails>({
    queryKey: ['physical-inventory', inventory.id],
    queryFn: () => fetchPhysicalInventory(inventory.id),
    staleTime: 0, // Always fresh
  })

  useEffect(() => {
    if (currentInventory?.items) {
      const initialQuantities: Record<string, number | ''> = {}
      const initialNotes: Record<string, string> = {}

      currentInventory.items.forEach((item) => {
        if (item.countedQuantity !== null) {
          initialQuantities[item.id] = item.countedQuantity
        }
        if (item.notes) {
          initialNotes[item.id] = item.notes
        }
      })

      setCountedQuantities(prev => ({ ...initialQuantities, ...prev }))
      setNotes(prev => ({ ...initialNotes, ...prev }))
    }
  }, [currentInventory])

  const updateItemMutation = useMutation({
    mutationFn: async ({ itemId, countedQuantity, notes }: { itemId: string; countedQuantity: number; notes?: string }) => {
      const res = await fetch(`/api/inventory/physical/${inventory.id}/items/${itemId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ countedQuantity, notes }),
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || error.details || 'Error al actualizar ítem')
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['physical-inventory', inventory.id] })
      queryClient.invalidateQueries({ queryKey: ['physical-inventories'] })
    },
    onError: (error: Error) => {
      toast(error.message, 'error')
    },
  })

  const saveAllMutation = useMutation({
    mutationFn: async () => {
      const itemsToSave = currentInventory?.items || []
      const updates = itemsToSave
        .filter(item => typeof countedQuantities[item.id] === 'number')
        .map(item => updateItemMutation.mutateAsync({
          itemId: item.id,
          countedQuantity: countedQuantities[item.id] as number,
          notes: notes[item.id] || '',
        }))

      await Promise.all(updates)
    },
    onSuccess: () => {
      toast('Cambios guardados exitosamente', 'success')
      onSuccess()
    },
    onError: (error: Error) => {
      toast(error.message, 'error')
    }
  })

  const completeMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/inventory/physical/${inventory.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'complete' }),
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || error.details || 'Error al completar')
      }
      return res.json()
    },
    onSuccess: () => {
      toast('Inventario completado. Stock actualizado.', 'success')
      queryClient.invalidateQueries({ queryKey: ['stock-levels'] })
      queryClient.invalidateQueries({ queryKey: ['inventory-movements'] })
      onSuccess()
    },
    onError: (error: Error) => {
      toast(error.message, 'error')
    }
  })

  if (isLoading) {
    return (
      <div className="p-12 flex flex-col items-center justify-center gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-gray-500 animate-pulse">Cargando detalles del inventario...</p>
      </div>
    )
  }

  if (isError) {
    return (
      <div className="p-12 text-center text-red-600 bg-red-50 rounded-lg border border-red-100 m-4">
        <AlertTriangle className="h-10 w-10 mx-auto mb-3" />
        <p className="font-bold">Error: {error instanceof Error ? error.message : 'Error desconocido'}</p>
        <Button variant="ghost" onClick={onClose} className="mt-4">Cerrar</Button>
      </div>
    )
  }

  const items = currentInventory?.items || []
  const allItemsCounted = items.every(item => {
    const current = countedQuantities[item.id]
    return typeof current === 'number' || item.countedQuantity !== null
  })

  return (
    <div className="flex flex-col h-full bg-white">
      <div className="p-4 border-b bg-gray-50/50 flex items-center justify-between">
        <div>
          <h3 className="font-bold text-gray-900">Conteo Físico: {currentInventory?.number}</h3>
          <p className="text-xs text-gray-500">Almacén: {currentInventory?.warehouse.name}</p>
        </div>
        <Button variant="ghost" size="sm" onClick={onClose} className="h-8 w-8 p-0">
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex-1 overflow-auto p-4">
        <div className="border rounded-lg shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="p-3 text-left font-bold text-gray-600">Producto / SKU</th>
                <th className="p-3 text-right font-bold text-gray-600">Sistema</th>
                <th className="p-3 text-center font-bold text-gray-600 w-32">Contado</th>
                <th className="p-3 text-right font-bold text-gray-600">Diff</th>
                <th className="p-3 text-left font-bold text-gray-600">Observaciones</th>
                <th className="p-3 text-center w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items.map(item => {
                const count = countedQuantities[item.id] ?? item.countedQuantity ?? ''
                const numCount = count === '' ? null : Number(count)
                const diff = numCount !== null ? numCount - item.systemQuantity : null

                return (
                  <tr key={item.id} className="hover:bg-gray-50/30 transition-colors">
                    <td className="p-3">
                      <div className="font-medium text-gray-900">{item.product.name}</div>
                      <div className="text-[10px] text-gray-400 font-mono tracking-tighter">
                        {item.product.sku} {item.variant && ` | ${item.variant.name}`}
                      </div>
                    </td>
                    <td className="p-3 text-right text-gray-500 whitespace-nowrap">
                      {item.systemQuantity.toLocaleString()} {item.product.unitOfMeasure}
                    </td>
                    <td className="p-3">
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={count}
                        onChange={(e) => setCountedQuantities({
                          ...countedQuantities,
                          [item.id]: e.target.value === '' ? '' : Number(e.target.value)
                        })}
                        className="h-8 text-right font-bold focus:ring-primary shadow-inner bg-white"
                        placeholder="0.00"
                      />
                    </td>
                    <td className="p-3 text-right">
                      {diff !== null && (
                        <span className={`font-black tracking-tighter ${diff > 0 ? 'text-green-600' : diff < 0 ? 'text-red-600' : 'text-gray-400'}`}>
                          {diff > 0 ? '+' : ''}{diff.toLocaleString()}
                        </span>
                      )}
                    </td>
                    <td className="p-3">
                      <Input
                        value={notes[item.id] || ''}
                        onChange={(e) => setNotes({ ...notes, [item.id]: e.target.value })}
                        className="h-8 text-xs bg-white border-transparent hover:border-gray-200 focus:border-primary"
                        placeholder="Nota..."
                      />
                    </td>
                    <td className="p-3">
                      {updateItemMutation.isPending && updateItemMutation.variables?.itemId === item.id ? (
                        <Loader2 className="h-3 w-3 animate-spin text-primary" />
                      ) : (
                        item.countedQuantity !== null && <CheckCircle className="h-3 w-3 text-green-500 opacity-50" />
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="p-6 border-t bg-gray-50/80 flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <div className="text-sm font-bold text-gray-700">
            Avance: {items.filter(i => (countedQuantities[i.id] !== undefined && countedQuantities[i.id] !== '') || i.countedQuantity !== null).length} / {items.length}
          </div>
          <div className="w-48 h-1.5 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-500"
              style={{ width: `${(items.filter(i => (countedQuantities[i.id] !== undefined && countedQuantities[i.id] !== '') || i.countedQuantity !== null).length / items.length) * 100}%` }}
            />
          </div>
        </div>

        <div className="flex gap-3">
          <Button variant="outline" onClick={onClose} disabled={saveAllMutation.isPending || completeMutation.isPending}>
            Descartar
          </Button>
          <Button
            variant="outline"
            className="border-primary text-primary hover:bg-primary/5"
            onClick={() => saveAllMutation.mutate()}
            disabled={saveAllMutation.isPending || completeMutation.isPending}
          >
            {saveAllMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
            Guardar Avance
          </Button>
          <Button
            className="bg-primary hover:bg-primary-hover shadow-lg shadow-primary/20"
            disabled={!allItemsCounted || completeMutation.isPending || saveAllMutation.isPending}
            onClick={() => {
              if (confirm('¿Estás seguro de completar el inventario? Esto actualizará el stock de forma irreversible.')) {
                completeMutation.mutate()
              }
            }}
          >
            {completeMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle className="h-4 w-4 mr-2" />}
            Completar Inventario
          </Button>
        </div>
      </div>
    </div>
  )
}

