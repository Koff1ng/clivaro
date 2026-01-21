'use client'

import React, { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { formatDate } from '@/lib/utils'
import { Printer, Save, X } from 'lucide-react'
import { useToast } from '@/components/ui/toast'
import { PhysicalInventoryPrint } from './physical-inventory-print'

export function PhysicalInventoryDetails({ inventory, onClose, onUpdate }: { inventory: any; onClose: () => void; onUpdate: () => void }) {
  const [editingNotes, setEditingNotes] = useState<Record<string, string>>({})
  const [editingItemId, setEditingItemId] = useState<string | null>(null)
  const [showPrintDialog, setShowPrintDialog] = useState(false)
  const { toast } = useToast()
  const queryClient = useQueryClient()

  // Initialize notes from inventory items
  React.useEffect(() => {
    const initialNotes: Record<string, string> = {}
    inventory.items?.forEach((item: any) => {
      if (item.notes) {
        initialNotes[item.id] = item.notes
      }
    })
    setEditingNotes(initialNotes)
  }, [inventory.items])

  const updateItemNotesMutation = useMutation({
    mutationFn: async ({ itemId, notes }: { itemId: string; notes: string }) => {
      const res = await fetch(`/api/inventory/physical/${inventory.id}/items/${itemId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          countedQuantity: inventory.items.find((i: any) => i.id === itemId)?.countedQuantity || 0,
          notes: notes || '',
        }),
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Error al actualizar observaciones')
      }
      return res.json()
    },
    onSuccess: () => {
      toast('Observaciones actualizadas', 'success')
      queryClient.invalidateQueries({ queryKey: ['physical-inventory', inventory.id] })
      queryClient.invalidateQueries({ queryKey: ['physical-inventories'] })
      setEditingItemId(null)
      onUpdate()
    },
    onError: (error: any) => {
      toast(error.message || 'Error al actualizar observaciones', 'error')
    },
  })

  const handleSaveNotes = (itemId: string) => {
    const notes = editingNotes[itemId] || ''
    updateItemNotesMutation.mutate({ itemId, notes })
  }

  const handleStartEditNotes = (itemId: string) => {
    const item = inventory.items?.find((i: any) => i.id === itemId)
    setEditingNotes({
      ...editingNotes,
      [itemId]: item?.notes || '',
    })
    setEditingItemId(itemId)
  }

  const handleCancelEditNotes = (itemId: string) => {
    const item = inventory.items?.find((i: any) => i.id === itemId)
    setEditingNotes({
      ...editingNotes,
      [itemId]: item?.notes || '',
    })
    setEditingItemId(null)
  }

  const totalItems = inventory.items?.length || 0
  const countedItems = inventory.items?.filter((item: any) => item.countedQuantity !== null).length || 0
  const itemsWithDifferences = inventory.items?.filter((item: any) =>
    item.countedQuantity !== null && item.difference !== null && item.difference !== 0
  ) || []

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">{inventory.number}</h2>
          <p className="text-sm text-gray-600 mt-1">
            Almacén: {inventory.warehouse?.name}
          </p>
        </div>
        <div className="flex gap-2">
          {inventory.status === 'COMPLETED' && (
            <Button onClick={() => setShowPrintDialog(true)}>
              <Printer className="h-4 w-4 mr-2" />
              Imprimir
            </Button>
          )}
          <Button variant="outline" onClick={onClose}>
            Cerrar
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <div className="border rounded-lg p-4">
          <div className="text-sm text-gray-600">Estado</div>
          <div className="text-lg font-semibold">
            {inventory.status === 'PENDING' ? 'Pendiente' :
              inventory.status === 'COUNTING' ? 'En Conteo' :
                inventory.status === 'COMPLETED' ? 'Completado' : 'Cancelado'}
          </div>
        </div>
        <div className="border rounded-lg p-4">
          <div className="text-sm text-gray-600">Total Productos</div>
          <div className="text-lg font-semibold">{totalItems}</div>
        </div>
        <div className="border rounded-lg p-4">
          <div className="text-sm text-gray-600">Contados</div>
          <div className="text-lg font-semibold">{countedItems} / {totalItems}</div>
        </div>
        <div className="border rounded-lg p-4">
          <div className="text-sm text-gray-600">Con Diferencias</div>
          <div className="text-lg font-semibold text-orange-600">{itemsWithDifferences.length}</div>
        </div>
      </div>

      {inventory.notes && (
        <div className="border rounded-lg p-4">
          <div className="text-sm text-gray-600 mb-2">Notas</div>
          <div className="text-sm">{inventory.notes}</div>
        </div>
      )}

      {(inventory.startedAt || inventory.completedAt || inventory.createdAt) && (
        <div className="grid grid-cols-3 gap-4">
          {inventory.createdAt && (
            <div className="border rounded-lg p-4">
              <div className="text-sm text-gray-600">Creado</div>
              <div className="text-sm font-semibold">{formatDate(inventory.createdAt)}</div>
            </div>
          )}
          {inventory.startedAt && (
            <div className="border rounded-lg p-4">
              <div className="text-sm text-gray-600">Iniciado</div>
              <div className="text-sm font-semibold">{formatDate(inventory.startedAt)}</div>
            </div>
          )}
          {inventory.completedAt && (
            <div className="border rounded-lg p-4">
              <div className="text-sm text-gray-600">Completado</div>
              <div className="text-sm font-semibold">{formatDate(inventory.completedAt)}</div>
            </div>
          )}
        </div>
      )}

      {inventory.createdBy && (
        <div className="border rounded-lg p-4">
          <div className="text-sm text-gray-600">Creado Por</div>
          <div className="text-sm font-semibold">{inventory.createdBy.name}</div>
        </div>
      )}

      <div>
        <h3 className="font-semibold mb-3">Productos</h3>
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left p-3">Producto</th>
                <th className="text-right p-3">Stock Sistema</th>
                <th className="text-right p-3">Cantidad Contada</th>
                <th className="text-right p-3">Diferencia</th>
                <th className="text-left p-3">Observaciones</th>
              </tr>
            </thead>
            <tbody>
              {inventory.items?.map((item: any) => {
                const difference = item.countedQuantity !== null
                  ? item.countedQuantity - item.systemQuantity
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
                    <td className="p-3 text-right">
                      <span className={item.countedQuantity !== null ? 'font-semibold' : 'text-gray-400'}>
                        {item.countedQuantity !== null
                          ? `${item.countedQuantity.toFixed(2)} ${item.product?.unitOfMeasure || ''}`
                          : 'Sin contar'}
                      </span>
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
                      {editingItemId === item.id ? (
                        <div className="flex gap-2 items-center">
                          <Input
                            type="text"
                            value={editingNotes[item.id] || ''}
                            onChange={(e) => setEditingNotes({
                              ...editingNotes,
                              [item.id]: e.target.value,
                            })}
                            placeholder="Observaciones..."
                            className="flex-1 text-sm"
                            autoFocus
                          />
                          <Button
                            size="sm"
                            onClick={() => handleSaveNotes(item.id)}
                            disabled={updateItemNotesMutation.isPending}
                          >
                            <Save className="h-3 w-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleCancelEditNotes(item.id)}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-gray-600 flex-1">
                            {item.notes || '-'}
                          </span>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleStartEditNotes(item.id)}
                            className="h-6 w-6 p-0"
                            title="Editar observaciones"
                          >
                            <span className="text-xs">✏️</span>
                          </Button>
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Print Dialog */}
      {showPrintDialog && (
        <Dialog open={showPrintDialog} onOpenChange={setShowPrintDialog}>
          <DialogContent className="w-auto sm:max-w-fit max-h-[90vh] overflow-y-auto">
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <DialogTitle>Formato de Inventario Físico</DialogTitle>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => window.print()}>
                    <Printer className="h-4 w-4 mr-2" />
                    Imprimir
                  </Button>
                  <Button variant="outline" onClick={() => setShowPrintDialog(false)}>
                    Cerrar
                  </Button>
                </div>
              </div>
              <PhysicalInventoryPrint inventory={inventory} />
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}

