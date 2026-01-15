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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'

const productSchema = z.object({
  name: z.string().min(1, 'El nombre es requerido'),
  sku: z.string().min(1, 'El SKU es requerido'),
  cost: z.number().min(0, 'El costo debe ser mayor o igual a 0'),
  price: z.number().min(0, 'El precio debe ser mayor o igual a 0'),
  unitOfMeasure: z.enum(['UNIT', 'BOX', 'METER', 'KILO', 'LITER']).default('UNIT'),
  taxRate: z.number().min(0).max(100).default(19),
  trackStock: z.boolean().default(true),
})

type ProductFormData = z.infer<typeof productSchema>

export function ProductQuickCreate({ 
  onProductCreated 
}: { 
  onProductCreated: (productId: string) => void 
}) {
  const { toast } = useToast()
  const [open, setOpen] = useState(false)
  const { register, handleSubmit, formState: { errors }, reset } = useForm<ProductFormData>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      name: '',
      sku: '',
      cost: 0,
      price: 0,
      unitOfMeasure: 'UNIT',
      taxRate: 19,
      trackStock: true,
    },
  })

  const mutation = useMutation({
    mutationFn: async (data: ProductFormData) => {
      const res = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          barcode: null,
          brand: null,
          category: null,
          description: null,
        }),
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Error al crear producto')
      }
      return res.json()
    },
    onSuccess: (product) => {
      reset()
      setOpen(false)
      onProductCreated(product.id)
    },
  })

  const onSubmit = async (data: ProductFormData) => {
    try {
      await mutation.mutateAsync(data)
    } catch (error: any) {
      toast(error.message || 'Error al crear producto', 'error')
    }
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className="text-blue-600"
      >
        + Crear Producto Nuevo
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Crear Producto Nuevo</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="name">Nombre del Producto *</Label>
                <Input
                  id="name"
                  {...register('name')}
                  placeholder="Ej: Martillo de Acero"
                />
                {errors.name && (
                  <p className="text-sm text-red-500">{errors.name.message}</p>
                )}
              </div>
              <div>
                <Label htmlFor="sku">SKU *</Label>
                <Input
                  id="sku"
                  {...register('sku')}
                  placeholder="Ej: MART-001"
                />
                {errors.sku && (
                  <p className="text-sm text-red-500">{errors.sku.message}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label htmlFor="cost">Costo Unitario *</Label>
                <Input
                  id="cost"
                  type="number"
                  step="0.01"
                  min="0"
                  {...register('cost', { valueAsNumber: true })}
                />
                {errors.cost && (
                  <p className="text-sm text-red-500">{errors.cost.message}</p>
                )}
              </div>
              <div>
                <Label htmlFor="price">Precio de Venta *</Label>
                <Input
                  id="price"
                  type="number"
                  step="0.01"
                  min="0"
                  {...register('price', { valueAsNumber: true })}
                />
                {errors.price && (
                  <p className="text-sm text-red-500">{errors.price.message}</p>
                )}
              </div>
              <div>
                <Label htmlFor="taxRate">IVA %</Label>
                <Input
                  id="taxRate"
                  type="number"
                  step="0.1"
                  min="0"
                  max="100"
                  {...register('taxRate', { valueAsNumber: true })}
                />
                {errors.taxRate && (
                  <p className="text-sm text-red-500">{errors.taxRate.message}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="unitOfMeasure">Unidad de Medida</Label>
                <select
                  id="unitOfMeasure"
                  {...register('unitOfMeasure')}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="UNIT">Unidad</option>
                  <option value="BOX">Caja</option>
                  <option value="METER">Metro</option>
                  <option value="KILO">Kilogramo</option>
                  <option value="LITER">Litro</option>
                </select>
              </div>
              <div className="flex items-center gap-2 pt-8">
                <input
                  type="checkbox"
                  id="trackStock"
                  {...register('trackStock')}
                  className="h-4 w-4"
                />
                <Label htmlFor="trackStock" className="cursor-pointer">
                  Controlar inventario
                </Label>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? 'Creando...' : 'Crear Producto'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}

