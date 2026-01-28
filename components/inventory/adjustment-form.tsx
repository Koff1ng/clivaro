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

const adjustmentSchema = z.object({
  quantity: z.number().min(0.01, {
    message: 'La cantidad debe ser mayor a 0',
  }),
  reason: z.string().min(1, 'La razón es requerida'),
  reasonCode: z.string().optional(),
  reasonNote: z.string().optional(),
})

type AdjustmentFormData = z.infer<typeof adjustmentSchema>

type AdjustmentType = 'ENTRADA' | 'SALIDA' | null

export function StockAdjustmentForm({ item, onSuccess }: { item: any; onSuccess: () => void }) {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [adjustmentType, setAdjustmentType] = useState<AdjustmentType>(null)
  const { register, handleSubmit, formState: { errors }, watch, setValue, reset } = useForm<AdjustmentFormData>({
    resolver: zodResolver(adjustmentSchema),
    defaultValues: {
      quantity: 0,
      reason: '',
      reasonCode: '',
      reasonNote: '',
    },
  })

  const quantity = watch('quantity')

  const mutation = useMutation({
    mutationFn: async (data: AdjustmentFormData) => {
      const res = await fetch('/api/inventory/adjustment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          warehouseId: item.warehouseId,
          productId: item.productId,
          variantId: item.variantId || null,
          quantity: data.quantity,
          reason: data.reason,
          reasonCode: data.reasonCode || null,
          reasonNote: data.reasonNote || null,
        }),
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Error al crear ajuste')
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
    onError: (error: any) => {
      toast(error.message || 'Error al crear ajuste', 'error')
    },
  })

  const onSubmit = async (data: AdjustmentFormData) => {
    if (!adjustmentType) {
      toast('Selecciona si es entrada o salida', 'error')
      return
    }
    if (data.quantity === 0) {
      toast('La cantidad no puede ser 0', 'error')
      return
    }
    // Si es salida, convertir a negativo
    const finalQuantity = adjustmentType === 'SALIDA' ? -Math.abs(data.quantity) : Math.abs(data.quantity)
    mutation.mutate({ ...data, quantity: finalQuantity })
  }

  const handleTypeSelect = (type: 'ENTRADA' | 'SALIDA') => {
    setAdjustmentType(type)
    setValue('quantity', 0)
  }

  if (!item) return null

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div>
        <Label>Producto</Label>
        <div className="text-sm text-gray-600">{item.productName} ({item.productSku})</div>
      </div>
      <div>
        <Label>Almacén</Label>
        <div className="text-sm text-gray-600">{item.warehouseName}</div>
      </div>
      <div>
        <Label>Stock Actual</Label>
        <div className="text-sm text-gray-600">{item.quantity.toFixed(2)} {item.unitOfMeasure}</div>
      </div>
      <div>
        <Label>Tipo de Ajuste *</Label>
        <div className="flex gap-2 mt-2">
          <Button
            type="button"
            variant={adjustmentType === 'ENTRADA' ? 'default' : 'outline'}
            onClick={() => handleTypeSelect('ENTRADA')}
            className="flex-1"
          >
            <Plus className="h-4 w-4 mr-2" />
            Entrada
          </Button>
          <Button
            type="button"
            variant={adjustmentType === 'SALIDA' ? 'default' : 'outline'}
            onClick={() => handleTypeSelect('SALIDA')}
            className="flex-1"
          >
            <Minus className="h-4 w-4 mr-2" />
            Salida
          </Button>
        </div>
      </div>
      <div>
        <Label htmlFor="quantity">
          Cantidad {adjustmentType === 'ENTRADA' ? '(Sumar)' : adjustmentType === 'SALIDA' ? '(Restar)' : ''}
        </Label>
        <Input
          id="quantity"
          type="number"
          step="0.01"
          min="0.01"
          disabled={!adjustmentType}
          {...register('quantity', { valueAsNumber: true })}
          placeholder={adjustmentType ? "0.00" : "Selecciona tipo primero"}
        />
        {errors.quantity && (
          <p className="text-sm text-red-500">{errors.quantity.message}</p>
        )}
        {adjustmentType && (
          <p className="text-xs text-gray-500 mt-1">
            {adjustmentType === 'ENTRADA'
              ? 'Ingresa la cantidad a sumar al inventario'
              : 'Ingresa la cantidad a restar del inventario'}
          </p>
        )}
      </div>
      <div>
        <Label htmlFor="reason">Razón del Ajuste *</Label>
        <Input
          id="reason"
          {...register('reason')}
          placeholder="Ej: Ajuste por inventario físico"
        />
        {errors.reason && (
          <p className="text-sm text-red-500">{errors.reason.message}</p>
        )}
      </div>

      {adjustmentType === 'SALIDA' && (
        <>
          <div>
            <Label htmlFor="reasonCode">Tipo de Salida (Opcional)</Label>
            <select
              id="reasonCode"
              {...register('reasonCode')}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">Seleccione un motivo...</option>
              <option value="WASTE">Desperdicio / Merma</option>
              <option value="SPILL">Derrame / Rotura</option>
              <option value="EXPIRED">Vencimiento</option>
              <option value="STAFF_MEAL">Consumo de Personal</option>
              <option value="OTHER">Otro</option>
            </select>
          </div>
          <div>
            <Label htmlFor="reasonNote">Notas Adicionales (Opcional)</Label>
            <textarea
              id="reasonNote"
              {...register('reasonNote')}
              className="flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              placeholder="Detalles adicionales sobre el ajuste..."
            />
          </div>
        </>
      )}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onSuccess}>
          Cancelar
        </Button>
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? 'Guardando...' : 'Aplicar Ajuste'}
        </Button>
      </div>
    </form>
  )
}

