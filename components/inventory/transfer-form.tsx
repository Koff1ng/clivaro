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

interface StockTransferItem {
  warehouseId: string
  warehouseName: string
  productId: string
  productName: string
  productSku: string
  variantId?: string | null
  quantity: number
  unitOfMeasure: string
}

interface Warehouse {
  id: string
  name: string
}

const transferSchema = z.object({
  toWarehouseId: z.string().min(1, 'Seleccione un almacén destino'),
  quantity: z.number().positive('La cantidad debe ser mayor a 0'),
  reason: z.string().optional(),
})

type TransferFormData = z.infer<typeof transferSchema>

export function StockTransferForm({ item, warehouses, onSuccess }: {
  item: StockTransferItem;
  warehouses: Warehouse[];
  onSuccess: () => void
}) {
  const { toast } = useToast()
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
          variantId: item.variantId || null,
          quantity: data.quantity,
          reason: data.reason || 'Transferencia',
        }),
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || error.details || 'Error al crear transferencia')
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock-levels'] })
      queryClient.invalidateQueries({ queryKey: ['low-stock'] })
      queryClient.invalidateQueries({ queryKey: ['inventory-movements'] })
      toast('Transferencia realizada exitosamente', 'success')
      onSuccess()
    },
    onError: (error: Error) => {
      toast(error.message, 'error')
    }
  })

  const onSubmit = (data: TransferFormData) => {
    mutation.mutate(data)
  }

  if (!item) return null

  const availableWarehouses = warehouses.filter((wh) => wh.id !== item.warehouseId)

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label className="text-xs uppercase text-gray-500">Producto</Label>
          <div className="text-sm font-medium">{item.productName}</div>
          <div className="text-xs text-gray-400">{item.productSku}</div>
        </div>
        <div>
          <Label className="text-xs uppercase text-gray-500">Origen</Label>
          <div className="text-sm font-medium">{item.warehouseName}</div>
        </div>
      </div>

      <div className="bg-blue-50 p-3 rounded-md border border-blue-100">
        <Label className="text-xs uppercase text-blue-600">Stock Disponible</Label>
        <div className="text-lg font-bold text-blue-900">
          {item.quantity.toLocaleString()} <span className="text-sm font-normal text-blue-600">{item.unitOfMeasure}</span>
        </div>
      </div>

      <div>
        <Label htmlFor="toWarehouseId">Almacén Destino *</Label>
        <select
          id="toWarehouseId"
          disabled={mutation.isPending}
          {...register('toWarehouseId')}
          className={`flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:ring-2 focus:ring-primary outline-none ${errors.toWarehouseId ? 'border-red-500' : ''}`}
        >
          <option value="">Seleccione el destino...</option>
          {availableWarehouses.map((wh) => (
            <option key={wh.id} value={wh.id}>{wh.name}</option>
          ))}
        </select>
        {errors.toWarehouseId && (
          <p className="text-xs text-red-500 mt-1">{errors.toWarehouseId.message}</p>
        )}
      </div>

      <div>
        <Label htmlFor="quantity">Cantidad a Transferir *</Label>
        <Input
          id="quantity"
          type="number"
          step="0.01"
          max={item.quantity}
          disabled={mutation.isPending}
          {...register('quantity', { valueAsNumber: true })}
          placeholder="0.00"
          className={errors.quantity ? 'border-red-500' : ''}
        />
        {errors.quantity && (
          <p className="text-xs text-red-500 mt-1">{errors.quantity.message}</p>
        )}
      </div>

      <div>
        <Label htmlFor="reason">Motivo (Opcional)</Label>
        <Input
          id="reason"
          disabled={mutation.isPending}
          {...register('reason')}
          placeholder="Ej: Reabastecimiento de mostrador"
        />
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t">
        <Button
          type="button"
          variant="ghost"
          onClick={onSuccess}
          disabled={mutation.isPending}
        >
          Cancelar
        </Button>
        <Button
          type="submit"
          disabled={mutation.isPending}
          className="min-w-[140px]"
        >
          {mutation.isPending ? (
            <div className="flex items-center">
              <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
              Transferiendo...
            </div>
          ) : 'Confirmar Transferencia'}
        </Button>
      </div>
    </form>
  )
}

