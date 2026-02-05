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
import { useRouter } from 'next/navigation'
import { Plus, Trash2, Utensils, Loader2 } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { RecipeEditor } from './recipe-editor'
import { UnitSelect } from './unit-select'

const productSchema = z.object({
  sku: z.string().min(1, 'SKU es requerido'),
  barcode: z.string().optional(),
  name: z.string().min(1, 'Nombre es requerido'),
  brand: z.string().optional(),
  category: z.string().optional(),
  unitOfMeasure: z.string().min(1, 'Unidad requerida').default('UNIT'),
  cost: z.number().min(0, 'Costo debe ser mayor o igual a 0'),
  price: z.number().min(0, 'Precio debe ser mayor o igual a 0'),
  taxRate: z.number().min(0).max(100),
  description: z.string().optional(),
  productType: z.enum(['RETAIL', 'SERVICE', 'RAW', 'PREPARED', 'SELLABLE']).default('RETAIL'),
  enableRecipeConsumption: z.boolean().default(false),
  printerStation: z.enum(['KITCHEN', 'BAR', 'CASHIER']).optional().nullable(),
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
  const router = useRouter()
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
      description: product.description || '',
      variants: product.variants?.map((v: any) => ({
        id: v.id,
        name: v.name,
        sku: v.sku,
        barcode: v.barcode,
        price: v.price,
        cost: v.cost,
      })) || [],
      productType: (product as any).productType || 'RETAIL',
      enableRecipeConsumption: (product as any).enableRecipeConsumption || false,
      printerStation: (product as any).printerStation || null,
    } : {
      unitOfMeasure: 'UNIT',
      cost: 0,
      price: 0,
      taxRate: 0,
      productType: 'RETAIL',
      enableRecipeConsumption: false,
      printerStation: null,
      variants: [],
    },
  })

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'variants',
  })

  const onSubmit = async (data: ProductFormData) => {
    setLoading(true)
    try {
      const url = product ? `/api/products/${product.id}` : '/api/products'
      const method = product ? 'PATCH' : 'POST'

      // Asegurar que category se envíe correctamente
      const payload: any = {
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
        <Controller
          control={control}
          name="unitOfMeasure"
          render={({ field }) => (
            <UnitSelect
              value={field.value}
              onChange={field.onChange}
            />
          )}
        />
      </div>

      <div>
        <Label htmlFor="printerStation">Impresora de Comandas (Opcional)</Label>
        <select
          id="printerStation"
          {...register('printerStation')}
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          <option value="">Principal (Caja)</option>
          <option value="KITCHEN">Cocina</option>
          <option value="BAR">Bar</option>
          <option value="CASHIER">Caja</option>
        </select>
        <p className="text-xs text-muted-foreground mt-1">Selecciona dónde se imprimirá la comanda de este producto</p>
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

      <div>
        <Label htmlFor="description">Descripción</Label>
        <textarea
          id="description"
          {...register('description')}
          className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          rows={3}
        />
      </div>

      <div className="space-y-4 pt-4 border-t">
        <Label className="text-base font-semibold">Configuración de Restaurante</Label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="productType">Tipo de Producto</Label>
            <select
              id="productType"
              {...register('productType')}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="RETAIL">Retail (Normal)</option>
              <option value="SERVICE">Servicio</option>
              <option value="RAW">Insumo / Materia Prima</option>
              <option value="PREPARED">Item Elaborado (No vendible)</option>
              <option value="SELLABLE">Plato / Vendible con Receta</option>
            </select>
            <p className="text-xs text-muted-foreground mt-1">
              Determina cómo se comporta este producto en inventario y recetas.
            </p>
          </div>
          <div className="flex items-center gap-2 pt-6">
            <input
              id="enableRecipeConsumption"
              type="checkbox"
              {...register('enableRecipeConsumption')}
              className="h-4 w-4 rounded border-gray-300"
            />
            <Label htmlFor="enableRecipeConsumption">Habilitar consumo por receta</Label>
          </div>
        </div>
        {watch('enableRecipeConsumption') && (
          <div className="p-3 bg-muted/30 rounded-lg text-sm">
            <p className="text-blue-600 font-medium">Consumo por Receta Activado</p>
            <p className="text-muted-foreground">Al vender este producto, se descontarán sus ingredientes definidos en la receta.</p>
            {product?.id && (
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" className="mt-2">
                    <Utensils className="h-4 w-4 mr-2" />
                    Editar Receta
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-3xl">
                  <DialogHeader>
                    <DialogTitle>Manejo de Receta (BOM)</DialogTitle>
                    <DialogDescription>
                      Define los ingredientes y cantidades para elaborar este producto.
                    </DialogDescription>
                  </DialogHeader>
                  <RecipeEditor
                    productId={product.id}
                    productName={product.name}
                  />
                </DialogContent>
              </Dialog>
            )}
          </div>
        )}
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

      <div className="flex flex-col-reverse sm:flex-row justify-between gap-2">
        <div className="flex justify-start">
          {product?.id && (
            <Dialog>
              <DialogTrigger asChild>
                <Button type="button" variant="destructive" disabled={loading}>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Eliminar Producto
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>¿Estás seguro?</DialogTitle>
                  <DialogDescription>
                    Esta acción marcará el producto como inactivo. No se eliminará del historial de ventas pero ya no estará disponible para nuevos movimientos.
                  </DialogDescription>
                </DialogHeader>
                <div className="flex justify-end gap-2 pt-4">
                  <Button type="button" variant="outline" onClick={() => { }} className="close-dialog">Cancelar</Button>
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={async (e) => {
                      // Prevent form submission
                      e.preventDefault()

                      if (!product.id) return

                      try {
                        setLoading(true)
                        const res = await fetch(`/api/products/${product.id}`, {
                          method: 'DELETE'
                        })

                        if (!res.ok) throw new Error('Failed to delete')

                        toast("Producto eliminado", "success")

                        router.push('/dashboard/products')
                        router.refresh()
                      } catch (err) {
                        toast("No se pudo eliminar el producto.", "error")
                      } finally {
                        setLoading(false)
                      }
                    }}
                  >
                    {loading ? <Loader2 className="animate-spin h-4 w-4" /> : 'Confirmar Eliminación'}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>

        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={onSuccess} className="w-full sm:w-auto">
            Cancelar
          </Button>
          <Button type="submit" disabled={loading} className="w-full sm:w-auto">
            {loading ? 'Guardando...' : product ? 'Actualizar' : 'Crear'}
          </Button>
        </div>
      </div>
    </form>
  )
}

