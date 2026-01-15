'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/components/ui/toast'

const transferSchema = z.object({
  toWarehouseId: z.string().min(1, 'Seleccione un almacén destino'),
  quantity: z.number().positive('La cantidad debe ser mayor a 0'),
  reason: z.string().optional(),
})

type TransferFormData = z.infer<typeof transferSchema>

export function StockTransferForm({ item, warehouses, onSuccess }: { item: any; warehouses: any[]; onSuccess: () => void }) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const queryClient = useQueryClient()
  const { register, handleSubmit, formState: { errors } } = useForm<TransferFormData>({
    resolver: zodResolver(transferSchema),
    defaultValues: {
      quantity: 0,
      reason: '',
    },
  })

  const mutation = useMutation({
    mutationFn: async (data: TransferFormData) => {
      const res = await fetch('/api/inventory/transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fromWarehouseId: item.warehouseId,
          toWarehouseId: data.toWarehouseId,
          productId: item.productId,
          quantity: data.quantity,
          reason: data.reason || 'Transferencia',
        }),
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Error al crear transferencia')
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock-levels'] })
      queryClient.invalidateQueries({ queryKey: ['low-stock'] })
      onSuccess()
    },
  })

  const onSubmit = async (data: TransferFormData) => {
    setLoading(true)
    try {
      await mutation.mutateAsync(data)
    } catch (error: any) {
      toast(error.message || 'Error al crear transferencia', 'error')
    } finally {
      setLoading(false)
    }
  }

  if (!item) return null

  const availableWarehouses = warehouses.filter((wh: any) => wh.id !== item.warehouseId)

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div>
        <Label>Producto</Label>
        <div className="text-sm text-gray-600">{item.productName} ({item.productSku})</div>
      </div>
      <div>
        <Label>Almacén Origen</Label>
        <div className="text-sm text-gray-600">{item.warehouseName}</div>
      </div>
      <div>
        <Label>Stock Disponible</Label>
        <div className="text-sm text-gray-600">{item.quantity.toFixed(2)} {item.unitOfMeasure}</div>
      </div>
      <div>
        <Label htmlFor="toWarehouseId">Almacén Destino *</Label>
        <select
          id="toWarehouseId"
          {...register('toWarehouseId')}
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          <option value="">Seleccione...</option>
          {availableWarehouses.map((wh: any) => (
            <option key={wh.id} value={wh.id}>{wh.name}</option>
          ))}
        </select>
        {errors.toWarehouseId && (
          <p className="text-sm text-red-500">{errors.toWarehouseId.message}</p>
        )}
      </div>
      <div>
        <Label htmlFor="quantity">Cantidad a Transferir *</Label>
        <Input
          id="quantity"
          type="number"
          step="0.01"
          max={item.quantity}
          {...register('quantity', { valueAsNumber: true })}
          placeholder="0.00"
        />
        {errors.quantity && (
          <p className="text-sm text-red-500">{errors.quantity.message}</p>
        )}
      </div>
      <div>
        <Label htmlFor="reason">Razón (Opcional)</Label>
        <Input
          id="reason"
          {...register('reason')}
          placeholder="Ej: Transferencia entre almacenes"
        />
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onSuccess}>
          Cancelar
        </Button>
        <Button type="submit" disabled={loading}>
          {loading ? 'Transferiendo...' : 'Transferir'}
        </Button>
      </div>
    </form>
  )
}

