'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/components/ui/toast'

interface Warehouse {
  id: string
  name: string
}

const formSchema = z.object({
  warehouseId: z.string().min(1, 'El almacén es requerido'),
  notes: z.string().optional().nullable(),
})

type FormData = z.infer<typeof formSchema>

export function PhysicalInventoryForm({ warehouses, onSuccess }: { warehouses: Warehouse[]; onSuccess: () => void }) {
  const { toast } = useToast()
  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      warehouseId: '',
      notes: '',
    }
  })

  const mutation = useMutation({
    mutationFn: async (data: FormData) => {
      const res = await fetch('/api/inventory/physical', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || error.details || 'Error al crear inventario físico')
      }
      return res.json()
    },
    onSuccess: () => {
      toast('Inventario físico creado exitosamente', 'success')
      onSuccess()
    },
    onError: (error: Error) => {
      toast(error.message, 'error')
    },
  })

  const onSubmit = (data: FormData) => {
    mutation.mutate(data)
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div>
        <Label htmlFor="warehouseId">Almacén Origen *</Label>
        <select
          id="warehouseId"
          disabled={mutation.isPending}
          {...register('warehouseId')}
          className={`flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:ring-2 focus:ring-primary outline-none ${errors.warehouseId ? 'border-red-500' : ''}`}
        >
          <option value="">Seleccionar almacén...</option>
          {warehouses.map((wh) => (
            <option key={wh.id} value={wh.id}>{wh.name}</option>
          ))}
        </select>
        {errors.warehouseId && (
          <p className="text-xs text-red-500 mt-1">{errors.warehouseId.message}</p>
        )}
        <p className="text-xs text-gray-400 mt-1">
          Se generará un listado detallado con todos los productos que tienen stock en este almacén.
        </p>
      </div>

      <div>
        <Label htmlFor="notes">Notas / Observaciones</Label>
        <Input
          id="notes"
          disabled={mutation.isPending}
          {...register('notes')}
          placeholder="Ej: Inventario semestral 2024"
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
          className="min-w-[150px]"
        >
          {mutation.isPending ? (
            <div className="flex items-center">
              <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
              Generando...
            </div>
          ) : 'Iniciar Inventario'}
        </Button>
      </div>
    </form>
  )
}

