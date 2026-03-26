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
import { useQuery } from '@tanstack/react-query'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Info } from 'lucide-react'

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
  printerStation: z.enum(['KITCHEN', 'BAR', 'CASHIER']).optional().nullable().or(z.literal('')),
  trackStock: z.boolean().default(true),
  minStock: z.number().min(0).optional(),
  maxStock: z.number().min(0).optional(),
  // Variants
  variants: z.array(z.object({
    id: z.string().optional(),
    name: z.string().min(1, 'Nombre requerido'),
    sku: z.string().optional(),
    barcode: z.string().optional(),
    price: z.number().min(0).optional(),
    cost: z.number().min(0).optional(),
    yieldFactor: z.number().min(0.001, 'Mínimo 0.001').default(1),
  })).optional(),
})

type ProductFormData = z.infer<typeof productSchema>

export function ProductForm({ product, onSuccess }: { product?: any; onSuccess: () => void }) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const { toast } = useToast()
  const { data: settingsData } = useQuery({
    queryKey: ['settings'],
    queryFn: async () => {
      const res = await fetch('/api/settings')
      if (!res.ok) throw new Error('Failed to fetch settings')
      const data = await res.json()
      return data.settings
    }
  })

  const enableRestaurantMode = settingsData?.enableRestaurantMode || false

  const stockLevel = product?.stockLevels?.[0]

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
      productType: (product as any).productType || 'RETAIL',
      enableRecipeConsumption: (product as any).enableRecipeConsumption || false,
      printerStation: (product as any).printerStation || null,
      trackStock: product.trackStock ?? true,
      minStock: stockLevel?.minStock || 0,
      maxStock: stockLevel?.maxStock || 0,
      variants: product.variants?.map((v: any) => ({
        id: v.id,
        name: v.name,
        sku: v.sku,
        barcode: v.barcode,
        price: v.price,
        cost: v.cost,
        yieldFactor: v.yieldFactor || 1,
      })) || [],
    } : {
      unitOfMeasure: 'UNIT',
      cost: 0,
      price: 0,
      taxRate: 0,
      productType: 'RETAIL',
      enableRecipeConsumption: false,
      printerStation: null,
      trackStock: true,
      minStock: 0,
      maxStock: 0,
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
        printerStation: data.printerStation === '' ? null : data.printerStation,
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

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div>
          <Label htmlFor="cost">Costo (sin IVA) *</Label>
          <Input
            id="cost"
            type="number"
            step="0.01"
            {...register('cost', { valueAsNumber: true })}
          />
          {errors.cost && <p className="text-sm text-red-500">{errors.cost.message}</p>}
          {watch('taxRate') > 0 && watch('cost') > 0 && (
            <p className="text-[10px] text-blue-500 mt-1 font-medium">
              Con IVA: ${((watch('cost') || 0) * (1 + (watch('taxRate') || 0) / 100)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          )}
        </div>
        <div>
          <Label htmlFor="price">Precio base (sin IVA) *</Label>
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
        <div>
          <Label className="text-green-700 dark:text-green-400 font-bold">Precio Unitario (PVP)</Label>
          <div className="flex h-10 w-full rounded-md border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/30 px-3 py-2 text-sm items-center">
            <span className="text-lg font-bold text-green-700 dark:text-green-400">
              ${((watch('price') || 0) * (1 + (watch('taxRate') || 0) / 100)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
          <p className="text-[10px] text-muted-foreground mt-1">Precio + IVA · por {watch('unitOfMeasure') || 'unidad'}</p>
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

      {/* Configuración de Inventario */}
      <div className="space-y-4 pt-4 border-t">
        <Label className="text-base font-semibold">Configuración de Inventario</Label>
        <div className="flex items-center gap-2 mb-3">
          <input
            id="trackStock"
            type="checkbox"
            {...register('trackStock')}
            className="h-4 w-4 rounded border-gray-300"
          />
          <Label htmlFor="trackStock" className="text-sm">Controlar inventario para este producto</Label>
        </div>

        {watch('trackStock') && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-blue-50/30 dark:bg-blue-950/10 border border-blue-100 dark:border-blue-900/30 rounded-xl">
            <div>
              <Label htmlFor="minStock">Stock Mínimo</Label>
              <Input
                id="minStock"
                type="number"
                step="0.01"
                {...register('minStock', { valueAsNumber: true })}
                placeholder="0"
              />
              <p className="text-[10px] text-muted-foreground mt-1">Se marcará como "BAJO" cuando el stock sea menor o igual a este valor</p>
            </div>
            <div>
              <Label htmlFor="maxStock">Stock Máximo</Label>
              <Input
                id="maxStock"
                type="number"
                step="0.01"
                {...register('maxStock', { valueAsNumber: true })}
                placeholder="0"
              />
              <p className="text-[10px] text-muted-foreground mt-1">Referencia para reabastecimiento. 0 = sin máximo configurado</p>
            </div>
            {product && stockLevel && (
              <div className="col-span-full grid grid-cols-3 gap-4 pt-2 border-t border-blue-100 dark:border-blue-900/30">
                <div className="space-y-0.5">
                  <Label className="text-[10px] uppercase font-bold text-muted-foreground">Stock Actual</Label>
                  <div className="text-sm font-mono font-bold text-slate-700 dark:text-slate-200">
                    {(stockLevel.quantity || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </div>
                </div>
                <div className="space-y-0.5">
                  <Label className="text-[10px] uppercase font-bold text-muted-foreground">Mín. Actual</Label>
                  <div className="text-sm font-mono font-bold text-orange-600">
                    {(stockLevel.minStock || 0).toLocaleString()}
                  </div>
                </div>
                <div className="space-y-0.5">
                  <Label className="text-[10px] uppercase font-bold text-muted-foreground">Máx. Actual</Label>
                  <div className="text-sm font-mono font-bold text-blue-600">
                    {(stockLevel.maxStock || 0).toLocaleString()}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {enableRestaurantMode && (
        <div className="space-y-4 pt-4 border-t">
          <Label className="text-base font-semibold">Configuración de Restaurante</Label>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-orange-50/30 dark:bg-orange-950/10 border border-orange-100 dark:border-orange-900/30 rounded-xl">
            <div className="space-y-1">
              <Label className="text-[10px] uppercase font-bold text-muted-foreground">Último Costo</Label>
              <div className="text-sm font-mono font-bold text-orange-600">
                ${(product?.lastCost || 0).toLocaleString()}
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] uppercase font-bold text-muted-foreground">Costo Promedio</Label>
              <div className="text-sm font-mono font-bold text-blue-600">
                ${(product?.averageCost || 0).toLocaleString()}
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] uppercase font-bold text-muted-foreground">Costo c/ Impuestos</Label>
              <div className="text-sm font-mono font-bold text-green-600">
                ${((watch('cost') || 0) * (1 + (watch('taxRate') || 0) / 100)).toLocaleString()}
              </div>
            </div>
          </div>

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
            </div>

            <div className="flex items-center gap-2 pt-6">
              <input
                id="enableRecipeConsumption"
                type="checkbox"
                {...register('enableRecipeConsumption')}
                className="h-4 w-4 rounded border-gray-300"
              />
              <Label htmlFor="enableRecipeConsumption" className="text-xs">Habilitar Receta</Label>
            </div>
          </div>

          {watch('enableRecipeConsumption') && (
            <div className="p-3 bg-muted/30 rounded-lg text-sm">
              {/* ... recipe details ... */}
              <p className="text-blue-600 font-medium">Consumo por Receta Activado</p>
              <p className="text-muted-foreground">Al vender este producto, se descontarán sus ingredientes definidos en la receta.</p>

              {product?.id ? (
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
              ) : (
                <Alert className="mt-2 py-2 bg-blue-50 border-blue-200">
                  <Info className="h-4 w-4 text-blue-600" />
                  <AlertDescription className="text-xs text-blue-700">
                    Guarda el producto primero para poder configurar su receta.
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}
        </div>
      )}

      {/* Security: Variants Section */}
      <div className="space-y-4 pt-4 border-t">
        <div className="flex items-center justify-between">
          <Label className="text-lg font-semibold">Variantes / Presentaciones</Label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => append({ name: '', sku: '', price: 0, cost: 0, yieldFactor: 1 })}
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
                <div className="col-span-12 sm:col-span-2">
                  <Label>Rendimiento</Label>
                  <Input
                    type="number"
                    step="0.01"
                    {...register(`variants.${index}.yieldFactor`, { valueAsNumber: true })}
                    placeholder="1.0"
                  />
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
                <div className="col-span-12 sm:col-span-1 flex justify-end">
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

