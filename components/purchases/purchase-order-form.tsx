'use client'

import { useState, useEffect } from 'react'
import { useForm, useFieldArray, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { DatePicker } from '@/components/ui/date-picker'
import { useToast } from '@/components/ui/toast'
import { useDebounce } from '@/lib/hooks/use-debounce'
import { formatCurrency } from '@/lib/utils'
import { Plus, Trash2 } from 'lucide-react'
import { ProductQuickCreate } from './product-quick-create'

const orderItemSchema = z.object({
  productId: z.string().min(1, 'Producto requerido'),
  variantId: z.string().optional().nullable(),
  quantity: z.number().positive('Cantidad debe ser mayor a 0'),
  unitCost: z.number().min(0, 'Costo debe ser mayor o igual a 0'),
  taxRate: z.number().min(0).max(100),
})

const orderSchema = z.object({
  supplierId: z.string().min(1, 'Proveedor requerido'),
  items: z.array(orderItemSchema).min(1, 'Debe agregar al menos un producto'),
  discount: z.number().min(0).default(0),
  expectedDate: z.string().optional().nullable(),
  notes: z.string().optional(),
})

type OrderFormData = z.infer<typeof orderSchema>

async function fetchProducts(search?: string) {
  const params = new URLSearchParams({ limit: '100' }) // Reducido de 1000 a 100
  if (search) params.append('search', search)
  const res = await fetch(`/api/products?${params}`)
  if (!res.ok) return []
  const data = await res.json()
  return data.products || []
}

async function fetchSuppliers(search?: string) {
  const params = new URLSearchParams({ limit: '100' }) // Reducido de 1000 a 100
  if (search) params.append('search', search)
  const res = await fetch(`/api/suppliers?${params}`)
  if (!res.ok) return []
  const data = await res.json()
  return data.suppliers || []
}

export function PurchaseOrderForm({ order, onSuccess }: { order?: any; onSuccess: () => void }) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const queryClient = useQueryClient()

  const [productSearch, setProductSearch] = useState('')
  const [supplierSearch, setSupplierSearch] = useState('')
  const debouncedProductSearch = useDebounce(productSearch, 300)
  const debouncedSupplierSearch = useDebounce(supplierSearch, 300)

  const { data: products = [], refetch: refetchProducts } = useQuery({
    queryKey: ['purchase-order-products', debouncedProductSearch],
    queryFn: () => fetchProducts(debouncedProductSearch || undefined),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000,
  })

  const { data: suppliers = [] } = useQuery({
    queryKey: ['purchase-order-suppliers', debouncedSupplierSearch],
    queryFn: () => fetchSuppliers(debouncedSupplierSearch || undefined),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000,
  })

  const { register, handleSubmit, formState: { errors }, control, watch, setValue } = useForm<OrderFormData>({
    resolver: zodResolver(orderSchema),
    defaultValues: {
      supplierId: '',
      items: [{ productId: '', quantity: 1, unitCost: 0, taxRate: 19 }],
      discount: 0,
      expectedDate: '',
      notes: '',
    },
  })

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'items',
  })

  const watchedItems = watch('items')
  const watchedDiscount = watch('discount')

  // Calculate totals
  useEffect(() => {
    let subtotal = 0
    watchedItems.forEach((item) => {
      if (item.productId && item.quantity > 0 && item.unitCost >= 0) {
        const itemSubtotal = item.quantity * item.unitCost
        subtotal += itemSubtotal
      }
    })
    const discount = watchedDiscount || 0
    const subtotalAfterDiscount = subtotal - discount
    const tax = watchedItems.reduce((sum, item) => {
      if (item.productId && item.quantity > 0 && item.unitCost >= 0) {
        const itemSubtotal = item.quantity * item.unitCost
        return sum + (itemSubtotal * (item.taxRate || 0) / 100)
      }
      return sum
    }, 0)
    const total = subtotalAfterDiscount + tax
  }, [watchedItems, watchedDiscount])

  useEffect(() => {
    if (order) {
      setValue('supplierId', order.supplierId)
      setValue('discount', order.discount || 0)
      setValue('expectedDate', order.expectedDate ? new Date(order.expectedDate).toISOString().split('T')[0] : '')
      setValue('notes', order.notes || '')
      if (order.items && order.items.length > 0) {
        setValue('items', order.items.map((item: any) => ({
          productId: item.productId,
          variantId: item.variantId || null,
          quantity: item.quantity,
          unitCost: item.unitCost,
          taxRate: item.taxRate || 19,
        })))
      }
    }
  }, [order, setValue])

  const mutation = useMutation({
    mutationFn: async (data: OrderFormData) => {
      const url = order ? `/api/purchases/orders/${order.id}` : '/api/purchases/orders'
      const method = order ? 'PUT' : 'POST'
      
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Error al guardar orden')
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] })
      queryClient.invalidateQueries({ queryKey: ['purchase-orders-sent'] }) // Invalidar también para recepciones
      queryClient.invalidateQueries({ queryKey: ['activity-feed'] })
      onSuccess()
    },
  })

  const onSubmit = async (data: OrderFormData) => {
    setLoading(true)
    try {
      await mutation.mutateAsync(data)
    } catch (error: any) {
      toast(error.message || 'Error al guardar orden', 'error')
    } finally {
      setLoading(false)
    }
  }

  const addItem = () => {
    append({ productId: '', quantity: 1, unitCost: 0, taxRate: 19 })
  }

  const removeItem = (index: number) => {
    if (fields.length > 1) {
      remove(index)
    }
  }

  const calculateTotals = () => {
    let subtotal = 0
    watchedItems.forEach((item) => {
      if (item.productId && item.quantity > 0 && item.unitCost >= 0) {
        subtotal += item.quantity * item.unitCost
      }
    })
    const discount = watchedDiscount || 0
    const subtotalAfterDiscount = subtotal - discount
    const tax = watchedItems.reduce((sum, item) => {
      if (item.productId && item.quantity > 0 && item.unitCost >= 0) {
        const itemSubtotal = item.quantity * item.unitCost
        return sum + (itemSubtotal * (item.taxRate || 0) / 100)
      }
      return sum
    }, 0)
    const total = subtotalAfterDiscount + tax
    return { subtotal, discount, tax, total }
  }

  const totals = calculateTotals()

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="supplierId">Proveedor *</Label>
          <select
            id="supplierId"
            {...register('supplierId')}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="">Seleccionar proveedor</option>
            {suppliers.map((supplier: any) => (
              <option key={supplier.id} value={supplier.id}>{supplier.name}</option>
            ))}
          </select>
          {errors.supplierId && (
            <p className="text-sm text-red-500">{errors.supplierId.message}</p>
          )}
        </div>
        <div>
          <Label htmlFor="expectedDate">Fecha Esperada</Label>
          <Controller
            name="expectedDate"
            control={control}
            render={({ field }) => (
              <DatePicker
                id="expectedDate"
                value={field.value || null}
                onChange={(value) => field.onChange(value || '')}
                placeholder="Seleccionar fecha"
              />
            )}
          />
        </div>
      </div>

      <div>
        <div className="flex justify-between items-center mb-2">
          <Label>Productos</Label>
          <div className="flex gap-2">
            <ProductQuickCreate 
              onProductCreated={async (productId) => {
                // Refresh products list
                await refetchProducts()
                // Get the newly created product to get its cost
                const res = await fetch(`/api/products/${productId}`)
                if (res.ok) {
                  const newProduct = await res.json()
                  // Add the new product to the last item or create new item
                  const lastIndex = fields.length - 1
                  if (lastIndex >= 0) {
                    setValue(`items.${lastIndex}.productId`, productId)
                    setValue(`items.${lastIndex}.unitCost`, newProduct.cost || 0)
                    setValue(`items.${lastIndex}.taxRate`, newProduct.taxRate || 19)
                  } else {
                    append({ 
                      productId, 
                      quantity: 1, 
                      unitCost: newProduct.cost || 0, 
                      taxRate: newProduct.taxRate || 19 
                    })
                  }
                } else {
                  // Fallback if product fetch fails
                  const lastIndex = fields.length - 1
                  if (lastIndex >= 0) {
                    setValue(`items.${lastIndex}.productId`, productId)
                  } else {
                    append({ productId, quantity: 1, unitCost: 0, taxRate: 19 })
                  }
                }
              }}
            />
            <Button type="button" onClick={addItem} variant="outline" size="sm">
              <Plus className="h-4 w-4 mr-1" />
              Agregar Producto
            </Button>
          </div>
        </div>
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Producto</TableHead>
                <TableHead>Cantidad</TableHead>
                <TableHead>Costo Unit.</TableHead>
                <TableHead>IVA %</TableHead>
                <TableHead>Subtotal</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {fields.map((field, index) => {
                const item = watchedItems[index]
                const product = products.find((p: any) => p.id === item?.productId)
                const itemSubtotal = (item?.quantity || 0) * (item?.unitCost || 0)
                const itemTax = itemSubtotal * ((item?.taxRate || 0) / 100)
                const itemTotal = itemSubtotal + itemTax

                return (
                  <TableRow key={field.id}>
                    <TableCell>
                      <select
                        {...register(`items.${index}.productId`)}
                        className="flex h-9 w-full rounded-md border border-input bg-background px-2 py-1 text-sm"
                      >
                        <option value="">Seleccionar</option>
                        {products.map((p: any) => (
                          <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>
                        ))}
                      </select>
                      {errors.items?.[index]?.productId && (
                        <p className="text-xs text-red-500">{errors.items[index]?.productId?.message}</p>
                      )}
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        step="0.01"
                        min="0.01"
                        {...register(`items.${index}.quantity`, { valueAsNumber: true })}
                        className="w-20"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        {...register(`items.${index}.unitCost`, { valueAsNumber: true })}
                        className="w-24"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        step="0.1"
                        min="0"
                        max="100"
                        {...register(`items.${index}.taxRate`, { valueAsNumber: true })}
                        className="w-20"
                      />
                    </TableCell>
                    <TableCell>{formatCurrency(itemTotal)}</TableCell>
                    <TableCell>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeItem(index)}
                        disabled={fields.length === 1}
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
        {errors.items && (
          <p className="text-sm text-red-500 mt-1">{errors.items.message}</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="discount">Descuento General</Label>
          <Input
            id="discount"
            type="number"
            step="0.01"
            min="0"
            {...register('discount', { valueAsNumber: true })}
          />
        </div>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600">Subtotal:</span>
            <span>{formatCurrency(totals.subtotal)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Descuento:</span>
            <span>{formatCurrency(totals.discount)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">IVA:</span>
            <span>{formatCurrency(totals.tax)}</span>
          </div>
          <div className="flex justify-between font-bold text-lg border-t pt-2">
            <span>Total:</span>
            <span>{formatCurrency(totals.total)}</span>
          </div>
        </div>
      </div>

      <div>
        <Label htmlFor="notes">Notas</Label>
        <textarea
          id="notes"
          {...register('notes')}
          rows={3}
          className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
      </div>

      <div className="flex justify-end gap-2 pt-4">
        <Button type="button" variant="outline" onClick={onSuccess}>
          Cancelar
        </Button>
        <Button type="submit" disabled={loading}>
          {loading ? 'Guardando...' : order ? 'Actualizar Orden' : 'Crear Orden'}
        </Button>
      </div>
    </form>
  )
}

