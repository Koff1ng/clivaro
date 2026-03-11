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
import { Plus, Minus } from 'lucide-react'

interface StockAdjustmentItem {
  warehouseId: string
  warehouseName: string
  productId: string
  productName: string
  productSku: string
  variantId?: string | null
  quantity: number
  unitOfMeasure: string
}

const adjustmentSchema = z.object({
  quantity: z.number().min(0.01, {
    message: 'La cantidad debe ser mayor a 0',
  }),
  reason: z.string().min(1, 'La razón es requerida'),
  reasonCode: z.string().optional().nullable(),
  reasonNote: z.string().optional().nullable(),
})

type AdjustmentFormData = z.infer<typeof adjustmentSchema>

type AdjustmentType = 'ENTRADA' | 'SALIDA' | null

export function StockAdjustmentForm({ item, onSuccess }: { item: StockAdjustmentItem; onSuccess: () => void }) {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [adjustmentType, setAdjustmentType] = useState<AdjustmentType>(null)
  const { register, handleSubmit, formState: { errors }, watch, setValue } = useForm<AdjustmentFormData>({
    resolver: zodResolver(adjustmentSchema),
    defaultValues: {
      quantity: 0,
      reason: '',
      reasonCode: '',
      reasonNote: '',
    },
  })

  const mutation = useMutation({
    mutationFn: async (data: AdjustmentFormData) => {
      const finalQuantity = adjustmentType === 'SALIDA' ? -Math.abs(data.quantity) : Math.abs(data.quantity)

      const res = await fetch('/api/inventory/adjustment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          warehouseId: item.warehouseId,
          productId: item.productId,
          variantId: item.variantId || null,
          quantity: finalQuantity,
          reason: data.reason,
          reasonCode: data.reasonCode || null,
          reasonNote: data.reasonNote || null,
        }),
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || error.details || 'Error al crear ajuste')
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock-levels'] })
      queryClient.invalidateQueries({ queryKey: ['low-stock'] })
      queryClient.invalidateQueries({ queryKey: ['inventory-movements'] })
      queryClient.invalidateQueries({ queryKey: ['activity-feed'] })
      toast('Ajuste de inventario aplicado exitosamente', 'success')
      onSuccess()
    },
    onError: (error: Error) => {
      toast(error.message, 'error')
    },
  })

  const onSubmit = (data: AdjustmentFormData) => {
    if (!adjustmentType) {
      toast('Selecciona si es entrada o salida', 'error')
      return
    }
    mutation.mutate(data)
  }

  const handleTypeSelect = (type: 'ENTRADA' | 'SALIDA') => {
    setAdjustmentType(type)
    setValue('quantity', 0)
  }

  if (!item) return null

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label className="text-xs uppercase text-gray-500">Producto</Label>
          <div className="text-sm font-medium">{item.productName}</div>
          <div className="text-xs text-gray-400">{item.productSku}</div>
        </div>
        <div>
          <Label className="text-xs uppercase text-gray-500">Almacén</Label>
          <div className="text-sm font-medium">{item.warehouseName}</div>
        </div>
      </div>

      <div className="bg-gray-50 p-3 rounded-md border border-gray-100">
        <Label className="text-xs uppercase text-gray-500">Stock Actual</Label>
        <div className="text-lg font-bold text-gray-700">
          {item.quantity.toLocaleString()} <span className="text-sm font-normal text-gray-500">{item.unitOfMeasure}</span>
        </div>
      </div>

      <div>
        <Label className="mb-2 block">Tipo de Ajuste *</Label>
        <div className="flex gap-2">
          <Button
            type="button"
            variant={adjustmentType === 'ENTRADA' ? 'default' : 'outline'}
            onClick={() => handleTypeSelect('ENTRADA')}
            className={`flex-1 transition-all ${adjustmentType === 'ENTRADA' ? 'ring-2 ring-primary ring-offset-1' : ''}`}
          >
            <Plus className="h-4 w-4 mr-2" />
            Entrada
          </Button>
          <Button
            type="button"
            variant={adjustmentType === 'SALIDA' ? 'default' : 'outline'}
            onClick={() => handleTypeSelect('SALIDA')}
            className={`flex-1 transition-all ${adjustmentType === 'SALIDA' ? 'ring-2 ring-primary ring-offset-1' : ''}`}
          >
            <Minus className="h-4 w-4 mr-2" />
            Salida
          </Button>
        </div>
      </div>

      <div>
        <Label htmlFor="quantity">
          Cantidad a {adjustmentType === 'ENTRADA' ? 'Sumar' : adjustmentType === 'SALIDA' ? 'Restar' : 'Ajustar'} *
        </Label>
        <Input
          id="quantity"
          type="number"
          step="0.01"
          min="0.01"
          autoFocus
          disabled={!adjustmentType || mutation.isPending}
          {...register('quantity', { valueAsNumber: true })}
          placeholder={adjustmentType ? "Ej: 10.00" : "Selecciona tipo primero"}
          className={errors.quantity ? 'border-red-500' : ''}
        />
        {errors.quantity && (
          <p className="text-xs text-red-500 mt-1">{errors.quantity.message}</p>
        )}
      </div>

      <div>
        <Label htmlFor="reason">Motivo del Ajuste *</Label>
        <Input
          id="reason"
          disabled={mutation.isPending}
          {...register('reason')}
          placeholder="Ej: Corrección de inventario físico"
          className={errors.reason ? 'border-red-500' : ''}
        />
        {errors.reason && (
          <p className="text-xs text-red-500 mt-1">{errors.reason.message}</p>
        )}
      </div>

      {adjustmentType === 'SALIDA' && (
        <div className="animate-in fade-in slide-in-from-top-2 duration-200">
          <Label htmlFor="reasonCode">Tipo de Salida</Label>
          <select
            id="reasonCode"
            disabled={mutation.isPending}
            {...register('reasonCode')}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:ring-2 focus:ring-primary outline-none"
          >
            <option value="">Seleccione un motivo...</option>
            <option value="WASTE">Desperdicio / Merma</option>
            <option value="SPILL">Derrame / Rotura</option>
            <option value="EXPIRED">Vencimiento</option>
            <option value="STAFF_MEAL">Consumo de Personal</option>
            <option value="RETURN_TO_SUPPLIER">Devolución a Proveedor</option>
            <option value="OTHER">Otro</option>
          </select>
        </div>
      )}

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
          disabled={mutation.isPending || !adjustmentType}
          className="min-w-[140px]"
        >
          {mutation.isPending ? (
            <div className="flex items-center">
              <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
              Procesando...
            </div>
          ) : 'Aplicar Ajuste'}
        </Button>
      </div>
    </form>
  )
}

