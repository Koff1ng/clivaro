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

const formSchema = z.object({
  warehouseId: z.string().min(1, 'El almacén es requerido'),
  notes: z.string().optional(),
})

type FormData = z.infer<typeof formSchema>

export function PhysicalInventoryForm({ warehouses, onSuccess }: { warehouses: any[]; onSuccess: () => void }) {
  const { toast } = useToast()
  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(formSchema),
  })

  const mutation = useMutation({
    mutationFn: async (data: FormData) => {
      const res = await fetch('/api/inventory/physical', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Error al crear inventario físico')
      }
      return res.json()
    },
    onSuccess: () => {
      toast('Inventario físico creado exitosamente', 'success')
      onSuccess()
    },
    onError: (error: any) => {
      toast(error.message || 'Error al crear inventario físico', 'error')
    },
  })

  const onSubmit = (data: FormData) => {
    mutation.mutate(data)
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div>
        <Label htmlFor="warehouseId">Almacén *</Label>
        <select
          id="warehouseId"
          {...register('warehouseId')}
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          <option value="">Seleccionar almacén...</option>
          {warehouses.map((wh: any) => (
            <option key={wh.id} value={wh.id}>{wh.name}</option>
          ))}
        </select>
        {errors.warehouseId && (
          <p className="text-sm text-red-500 mt-1">{errors.warehouseId.message}</p>
        )}
      </div>

      <div>
        <Label htmlFor="notes">Notas</Label>
        <Input
          id="notes"
          {...register('notes')}
          placeholder="Notas adicionales (opcional)"
        />
      </div>

      <div className="flex justify-end gap-2 pt-4">
        <Button type="button" variant="outline" onClick={onSuccess}>
          Cancelar
        </Button>
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? 'Creando...' : 'Crear Inventario'}
        </Button>
      </div>
    </form>
  )
}

