'use client'

import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/components/ui/toast'

const supplierSchema = z.object({
  name: z.string().min(1, 'El nombre es requerido'),
  phone: z.string().optional(),
  email: z.string().email('Email inválido').optional().or(z.literal('')),
  address: z.string().optional(),
  taxId: z.string().optional(),
  notes: z.string().optional(),
  active: z.boolean().default(true),
})

type SupplierFormData = z.infer<typeof supplierSchema>

export function SupplierForm({ supplier, onSuccess }: { supplier: any; onSuccess: () => void }) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const queryClient = useQueryClient()
  const { register, handleSubmit, formState: { errors }, setValue } = useForm<SupplierFormData>({
    resolver: zodResolver(supplierSchema),
    defaultValues: {
      name: '',
      phone: '',
      email: '',
      address: '',
      taxId: '',
      notes: '',
      active: true,
    },
  })

  useEffect(() => {
    if (supplier) {
      setValue('name', supplier.name || '')
      setValue('phone', supplier.phone || '')
      setValue('email', supplier.email || '')
      setValue('address', supplier.address || '')
      setValue('taxId', supplier.taxId || '')
      setValue('notes', supplier.notes || '')
      setValue('active', supplier.active !== false)
    }
  }, [supplier, setValue])

  const mutation = useMutation({
    mutationFn: async (data: SupplierFormData) => {
      const url = supplier ? `/api/suppliers/${supplier.id}` : '/api/suppliers'
      const method = supplier ? 'PUT' : 'POST'
      
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Error al guardar proveedor')
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] })
      onSuccess()
    },
  })

  const onSubmit = async (data: SupplierFormData) => {
    setLoading(true)
    try {
      await mutation.mutateAsync(data)
    } catch (error: any) {
      toast(error.message || 'Error al guardar proveedor', 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="name">Nombre *</Label>
          <Input
            id="name"
            {...register('name')}
            placeholder="Nombre del proveedor"
          />
          {errors.name && (
            <p className="text-sm text-red-500">{errors.name.message}</p>
          )}
        </div>
        <div>
          <Label htmlFor="taxId">NIT / Identificación</Label>
          <Input
            id="taxId"
            {...register('taxId')}
            placeholder="NIT o número de identificación"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            {...register('email')}
            placeholder="email@ejemplo.com"
          />
          {errors.email && (
            <p className="text-sm text-red-500">{errors.email.message}</p>
          )}
        </div>
        <div>
          <Label htmlFor="phone">Teléfono</Label>
          <Input
            id="phone"
            {...register('phone')}
            placeholder="+57 300 123 4567"
          />
        </div>
      </div>

      <div>
        <Label htmlFor="address">Dirección</Label>
        <Input
          id="address"
          {...register('address')}
          placeholder="Dirección completa"
        />
      </div>

      <div>
        <Label htmlFor="notes">Notas</Label>
        <textarea
          id="notes"
          {...register('notes')}
          rows={4}
          className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          placeholder="Notas adicionales sobre el proveedor..."
        />
      </div>

      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="active"
          {...register('active')}
          className="h-4 w-4"
        />
        <Label htmlFor="active" className="cursor-pointer">
          Proveedor activo
        </Label>
      </div>

      <div className="flex justify-end gap-2 pt-4">
        <Button type="button" variant="outline" onClick={onSuccess}>
          Cancelar
        </Button>
        <Button type="submit" disabled={loading}>
          {loading ? 'Guardando...' : supplier ? 'Actualizar' : 'Crear Proveedor'}
        </Button>
      </div>
    </form>
  )
}

