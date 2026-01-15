'use client'

import { useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/components/ui/toast'
import { CategorySelect } from './category-select'

const productSchema = z.object({
  sku: z.string().min(1, 'SKU es requerido'),
  barcode: z.string().optional(),
  name: z.string().min(1, 'Nombre es requerido'),
  brand: z.string().optional(),
  category: z.string().optional(),
  unitOfMeasure: z.enum(['UNIT', 'BOX', 'METER', 'KILO', 'LITER']),
  cost: z.number().min(0, 'Costo debe ser mayor o igual a 0'),
  price: z.number().min(0, 'Precio debe ser mayor o igual a 0'),
  taxRate: z.number().min(0).max(100),
  trackStock: z.boolean(),
  description: z.string().optional(),
})

type ProductFormData = z.infer<typeof productSchema>

export function ProductForm({ product, onSuccess }: { product?: any; onSuccess: () => void }) {
  const [loading, setLoading] = useState(false)
  const { toast } = useToast()
  const { register, handleSubmit, formState: { errors }, setValue, watch, control } = useForm<ProductFormData>({
    resolver: zodResolver(productSchema),
    defaultValues: product ? {
      sku: product.sku,
      barcode: product.barcode || '',
      name: product.name,
      brand: product.brand || '',
      category: product.category || '',
      unitOfMeasure: product.unitOfMeasure,
      cost: product.cost,
      price: product.price,
      taxRate: product.taxRate,
      trackStock: product.trackStock,
      description: product.description || '',
    } : {
      unitOfMeasure: 'UNIT',
      cost: 0,
      price: 0,
      taxRate: 0,
      trackStock: true,
    },
  })

  const trackStock = watch('trackStock')

  const onSubmit = async (data: ProductFormData) => {
    setLoading(true)
    try {
      const url = product ? `/api/products/${product.id}` : '/api/products'
      const method = product ? 'PATCH' : 'POST'
      
      // Asegurar que category se envíe correctamente
      const payload = {
        ...data,
        category: data.category && data.category.trim() !== '' ? data.category.trim() : null,
      }
      
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Error al guardar producto')
      }

      onSuccess()
    } catch (error: any) {
      toast(error.message || 'Error al guardar producto', 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="sku">SKU *</Label>
          <Input id="sku" {...register('sku')} />
          {errors.sku && <p className="text-sm text-red-500">{errors.sku.message}</p>}
        </div>
        <div>
          <Label htmlFor="barcode">Código de Barras</Label>
          <Input id="barcode" {...register('barcode')} />
        </div>
      </div>

      <div>
        <Label htmlFor="name">Nombre *</Label>
        <Input id="name" {...register('name')} />
        {errors.name && <p className="text-sm text-red-500">{errors.name.message}</p>}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="brand">Marca</Label>
          <Input id="brand" {...register('brand')} />
        </div>
        <div>
          <Label htmlFor="category">Categoría</Label>
          <Controller
            name="category"
            control={control}
            render={({ field }) => (
              <CategorySelect
                id="category"
                value={field.value || ''}
                onChange={field.onChange}
                onBlur={field.onBlur}
              />
            )}
          />
        </div>
      </div>

      <div>
        <Label htmlFor="unitOfMeasure">Unidad de Medida *</Label>
        <select
          id="unitOfMeasure"
          {...register('unitOfMeasure')}
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          <option value="UNIT">Unidad</option>
          <option value="BOX">Caja</option>
          <option value="METER">Metro</option>
          <option value="KILO">Kilo</option>
          <option value="LITER">Litro</option>
        </select>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <Label htmlFor="cost">Costo *</Label>
          <Input
            id="cost"
            type="number"
            step="0.01"
            {...register('cost', { valueAsNumber: true })}
          />
          {errors.cost && <p className="text-sm text-red-500">{errors.cost.message}</p>}
        </div>
        <div>
          <Label htmlFor="price">Precio *</Label>
          <Input
            id="price"
            type="number"
            step="0.01"
            {...register('price', { valueAsNumber: true })}
          />
          {errors.price && <p className="text-sm text-red-500">{errors.price.message}</p>}
        </div>
        <div>
          <Label htmlFor="taxRate">IVA (%) *</Label>
          <Input
            id="taxRate"
            type="number"
            step="0.01"
            {...register('taxRate', { valueAsNumber: true })}
          />
          {errors.taxRate && <p className="text-sm text-red-500">{errors.taxRate.message}</p>}
        </div>
      </div>

      <div>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            {...register('trackStock')}
            className="rounded border-gray-300"
          />
          <span>Controlar stock</span>
        </label>
      </div>

      <div>
        <Label htmlFor="description">Descripción</Label>
        <textarea
          id="description"
          {...register('description')}
          className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          rows={3}
        />
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onSuccess}>
          Cancelar
        </Button>
        <Button type="submit" disabled={loading}>
          {loading ? 'Guardando...' : product ? 'Actualizar' : 'Crear'}
        </Button>
      </div>
    </form>
  )
}

