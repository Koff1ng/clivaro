'use client'

import { useState } from 'react'
import { useForm, Controller, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/components/ui/toast'
import { CategorySelect } from './category-select'
import { Plus, Trash2 } from 'lucide-react'

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
  minStock: z.number().min(0, 'Mínimo debe ser mayor o igual a 0').optional(),
  maxStock: z.number().min(0, 'Máximo debe ser mayor o igual a 0').optional().nullable(),
  description: z.string().optional(),
  // Variants
  variants: z.array(z.object({
    id: z.string().optional(),
    name: z.string().min(1, 'Nombre requerido'),
    sku: z.string().optional(),
    barcode: z.string().optional(),
    price: z.number().min(0).optional(),
    cost: z.number().min(0).optional(),
  })).optional(),
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
      // Use first stockLevel if present, else defaults
      minStock: product.stockLevels?.[0]?.minStock ?? 0,
      maxStock: product.stockLevels?.[0]?.maxStock ?? undefined,
      description: product.description || '',
      variants: product.variants?.map((v: any) => ({
        id: v.id,
        name: v.name,
        sku: v.sku,
        barcode: v.barcode,
        price: v.price,
        cost: v.cost,
      })) || [],
    } : {
      unitOfMeasure: 'UNIT',
      cost: 0,
      price: 0,
      taxRate: 0,
      trackStock: true,
      minStock: 0,
      variants: [],
    },
  })

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'variants',
  })

  const trackStock = watch('trackStock')

  const onSubmit = async (data: ProductFormData) => {
    setLoading(true)
    try {
      const url = product ? `/api/products/${product.id}` : '/api/products'
      const method = product ? 'PATCH' : 'POST'

      // Asegurar que category se envíe correctamente
      // Manejar minStock y maxStock correctamente
      const payload: any = {
        ...data,
        category: data.category && data.category.trim() !== '' ? data.category.trim() : null,
      }

      // Solo incluir minStock y maxStock si trackStock está activado
      if (data.trackStock) {
        payload.minStock = data.minStock !== undefined && data.minStock !== null && !isNaN(Number(data.minStock))
          ? Number(data.minStock)
          : 0
        // maxStock es opcional: si está vacío, undefined o NaN, enviar 0 (sin máximo)
        if (data.maxStock !== undefined && data.maxStock !== null && !isNaN(Number(data.maxStock)) && Number(data.maxStock) > 0) {
          payload.maxStock = Number(data.maxStock)
        } else {
          payload.maxStock = 0 // 0 significa sin máximo configurado
        }
      } else {
        // Si no se controla stock, no enviar estos campos
        delete payload.minStock
        delete payload.maxStock
      }

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const error = await res.json()
        const errorMessage = error.details || error.error || 'Error al guardar producto'
        throw new Error(errorMessage)
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
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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

      {trackStock && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="minStock">Stock mínimo *</Label>
            <Input
              id="minStock"
              type="number"
              step="0.01"
              min="0"
              {...register('minStock', { valueAsNumber: true })}
            />
            {errors.minStock && <p className="text-sm text-red-500">{errors.minStock.message}</p>}
          </div>
          <div>
            <Label htmlFor="maxStock">Stock máximo (opcional)</Label>
            <Input
              id="maxStock"
              type="number"
              step="0.01"
              min="0"
              {...register('maxStock', {
                valueAsNumber: true,
                setValueAs: (v) => {
                  if (v === '' || v === null || v === undefined) return undefined
                  const num = Number(v)
                  return isNaN(num) ? undefined : num
                }
              })}
            />
            {errors.maxStock && <p className="text-sm text-red-500">{errors.maxStock.message}</p>}
          </div>
        </div>
      )}

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

      {/* Security: Variants Section */}
      <div className="space-y-4 pt-4 border-t">
        <div className="flex items-center justify-between">
          <Label className="text-lg font-semibold">Variantes / Presentaciones</Label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => append({ name: '', sku: '', price: 0, cost: 0 })}
          >
            <Plus className="h-4 w-4 mr-2" />
            Agregar Variante
          </Button>
        </div>

        {fields.length > 0 && (
          <div className="space-y-4">
            {fields.map((field, index) => (
              <div key={field.id} className="grid grid-cols-12 gap-2 p-4 border rounded-md bg-muted/20 items-end">
                <div className="col-span-12 sm:col-span-3">
                  <Label>Nombre (Talla/Color)</Label>
                  <Input {...register(`variants.${index}.name`)} placeholder="Ej: Rojo, XL" />
                  {errors.variants?.[index]?.name && (
                    <p className="text-xs text-red-500">{errors.variants[index]?.name?.message}</p>
                  )}
                </div>
                <div className="col-span-12 sm:col-span-3">
                  <Label>SKU (Opcional)</Label>
                  <Input {...register(`variants.${index}.sku`)} placeholder="SKU Único" />
                </div>
                <div className="col-span-6 sm:col-span-2">
                  <Label>Costo</Label>
                  <Input
                    type="number"
                    step="0.01"
                    {...register(`variants.${index}.cost`, { valueAsNumber: true })}
                  />
                </div>
                <div className="col-span-6 sm:col-span-2">
                  <Label>Precio</Label>
                  <Input
                    type="number"
                    step="0.01"
                    {...register(`variants.${index}.price`, { valueAsNumber: true })}
                  />
                </div>
                <div className="col-span-12 sm:col-span-2 flex justify-end">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="text-red-500 hover:text-red-600 hover:bg-red-50"
                    onClick={() => remove(index)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-col-reverse sm:flex-row justify-end gap-2">
        <Button type="button" variant="outline" onClick={onSuccess} className="w-full sm:w-auto">
          Cancelar
        </Button>
        <Button type="submit" disabled={loading} className="w-full sm:w-auto">
          {loading ? 'Guardando...' : product ? 'Actualizar' : 'Crear'}
        </Button>
      </div>
    </form>
  )
}

