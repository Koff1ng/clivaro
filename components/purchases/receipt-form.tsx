'use client'

import { useState, useEffect } from 'react'
import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/components/ui/toast'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatCurrency } from '@/lib/utils'
import { Plus, Trash2 } from 'lucide-react'

const receiptItemSchema = z.object({
  productId: z.string().min(1, 'Producto requerido'),
  variantId: z.string().optional().nullable(),
  quantity: z.number().positive('Cantidad debe ser mayor a 0'),
  unitCost: z.number().min(0, 'Costo debe ser mayor o igual a 0'),
  purchaseOrderItemId: z.string().optional(),
})

const receiptSchema = z.object({
  purchaseOrderId: z.string().min(1, 'Orden de compra requerida'),
  warehouseId: z.string().min(1, 'Almacén requerido'),
  items: z.array(receiptItemSchema).min(1, 'Debe agregar al menos un producto'),
  notes: z.string().optional(),
})

type ReceiptFormData = z.infer<typeof receiptSchema>

async function fetchPurchaseOrders() {
  // Fetch orders that can be received (SENT or DRAFT, but not RECEIVED or CANCELLED)
  const res = await fetch('/api/purchases/orders?limit=1000')
  if (!res.ok) {
    return []
  }
  const data = await res.json()
  // Filter orders that can be received (not RECEIVED or CANCELLED)
  const orders = data.orders || []
  const filteredOrders = orders.filter((order: any) => order.status !== 'RECEIVED' && order.status !== 'CANCELLED')
  return filteredOrders
}

async function fetchWarehouses() {
  const res = await fetch('/api/warehouses')
  if (!res.ok) return []
  return res.json()
}

async function fetchProducts() {
  const res = await fetch('/api/products?limit=1000')
  if (!res.ok) return []
  const data = await res.json()
  return data.products || []
}

export function ReceiptForm({ 
  purchaseOrderId, 
  onSuccess 
}: { 
  purchaseOrderId?: string | null
  onSuccess: () => void 
}) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const queryClient = useQueryClient()

  const { data: purchaseOrders = [], refetch: refetchOrders } = useQuery({
    queryKey: ['purchase-orders-sent'],
    queryFn: fetchPurchaseOrders,
    staleTime: 0, // Siempre considerar los datos como obsoletos para ver órdenes nuevas
    refetchOnWindowFocus: true, // Refrescar cuando la ventana recupera el foco
  })

  const { data: warehouses = [] } = useQuery({
    queryKey: ['warehouses'],
    queryFn: fetchWarehouses,
  })

  const { data: products = [] } = useQuery({
    queryKey: ['products'],
    queryFn: fetchProducts,
  })

  const { register, handleSubmit, formState: { errors }, control, watch, setValue } = useForm<ReceiptFormData>({
    resolver: zodResolver(receiptSchema),
    defaultValues: {
      purchaseOrderId: purchaseOrderId || '',
      warehouseId: '',
      items: [],
      notes: '',
    },
  })

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'items',
  })

  const watchedPurchaseOrderId = watch('purchaseOrderId')
  const watchedItems = watch('items')

  // Load purchase order items when order is selected
  useEffect(() => {
    if (watchedPurchaseOrderId) {
      const order = purchaseOrders.find((o: any) => o.id === watchedPurchaseOrderId)
      if (order && order.items) {
        // Load items from purchase order
        setValue('items', order.items.map((item: any) => ({
          productId: item.productId,
          variantId: item.variantId || null,
          quantity: item.quantity,
          unitCost: item.unitCost,
          purchaseOrderItemId: item.id,
        })))
      }
    } else {
      setValue('items', [])
    }
  }, [watchedPurchaseOrderId, purchaseOrders, setValue])

  // Set default warehouse if only one exists
  useEffect(() => {
    if (warehouses.length === 1 && !watch('warehouseId')) {
      setValue('warehouseId', warehouses[0].id)
    }
  }, [warehouses, setValue, watch])

  const mutation = useMutation({
    mutationFn: async (data: ReceiptFormData) => {
      const res = await fetch('/api/purchases/receipts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Error al crear recepción')
      }
      return res.json()
    },
    onSuccess: () => {
      // Invalidar todas las queries relacionadas para actualización en tiempo real
      queryClient.invalidateQueries({ queryKey: ['receipts'] })
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] })
      queryClient.invalidateQueries({ queryKey: ['purchase-orders-sent'] })
      queryClient.invalidateQueries({ queryKey: ['stock-levels'] })
      queryClient.invalidateQueries({ queryKey: ['inventory-movements'] })
      queryClient.invalidateQueries({ queryKey: ['low-stock'] })
      queryClient.invalidateQueries({ queryKey: ['products'] })
      queryClient.invalidateQueries({ queryKey: ['pos-products'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] })
      queryClient.invalidateQueries({ queryKey: ['activity-feed'] })
      toast('Recepción creada exitosamente. El inventario se ha actualizado.', 'success')
      onSuccess()
    },
  })

  const onSubmit = async (data: ReceiptFormData) => {
    setLoading(true)
    try {
      await mutation.mutateAsync(data)
    } catch (error: any) {
      toast(error.message || 'Error al crear recepción', 'error')
    } finally {
      setLoading(false)
    }
  }

  const addItem = () => {
    append({ productId: '', quantity: 1, unitCost: 0 })
  }

  const removeItem = (index: number) => {
    if (fields.length > 1) {
      remove(index)
    }
  }

  const calculateTotal = () => {
    return watchedItems.reduce((sum, item) => {
      if (item.productId && item.quantity > 0 && item.unitCost >= 0) {
        return sum + (item.quantity * item.unitCost)
      }
      return sum
    }, 0)
  }

  const total = calculateTotal()

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <div className="flex items-center justify-between mb-2">
            <Label htmlFor="purchaseOrderId">Orden de Compra *</Label>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => refetchOrders()}
              className="text-xs"
            >
              🔄 Actualizar lista
            </Button>
          </div>
          <select
            id="purchaseOrderId"
            {...register('purchaseOrderId')}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="">Seleccionar orden</option>
            {purchaseOrders.length === 0 ? (
              <option value="" disabled>No hay órdenes disponibles</option>
            ) : (
              purchaseOrders.map((order: any) => (
                <option key={order.id} value={order.id}>
                  {order.number} - {order.supplier?.name} ({order.status})
                </option>
              ))
            )}
          </select>
          {errors.purchaseOrderId && (
            <p className="text-sm text-red-500">{errors.purchaseOrderId.message}</p>
          )}
          {purchaseOrders.length === 0 && (
            <p className="text-sm text-gray-500 mt-1">
              No hay órdenes de compra disponibles. Crea una orden de compra primero.
            </p>
          )}
        </div>
        <div>
          <Label htmlFor="warehouseId">Almacén *</Label>
          <select
            id="warehouseId"
            {...register('warehouseId')}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="">Seleccionar almacén</option>
            {warehouses.map((warehouse: any) => (
              <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>
            ))}
          </select>
          {errors.warehouseId && (
            <p className="text-sm text-red-500">{errors.warehouseId.message}</p>
          )}
        </div>
      </div>

      <div>
        <div className="flex justify-between items-center mb-2">
          <Label>Productos Recibidos</Label>
          <Button type="button" onClick={addItem} variant="outline" size="sm">
            <Plus className="h-4 w-4 mr-1" />
            Agregar Producto
          </Button>
        </div>
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Producto</TableHead>
                <TableHead>Cantidad</TableHead>
                <TableHead>Costo Unit.</TableHead>
                <TableHead>Subtotal</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {fields.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-gray-500 py-4">
                    Selecciona una orden de compra para cargar los productos
                  </TableCell>
                </TableRow>
              ) : (
                fields.map((field, index) => {
                  const item = watchedItems[index]
                  const product = products.find((p: any) => p.id === item?.productId)
                  const itemTotal = (item?.quantity || 0) * (item?.unitCost || 0)

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
                })
              )}
            </TableBody>
          </Table>
        </div>
        {errors.items && (
          <p className="text-sm text-red-500 mt-1">{errors.items.message}</p>
        )}
      </div>

      <div className="flex justify-end">
        <div className="w-64 space-y-2 text-sm">
          <div className="flex justify-between font-bold text-lg border-t pt-2">
            <span>Total:</span>
            <span>{formatCurrency(total)}</span>
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
          {loading ? 'Creando...' : 'Crear Recepción'}
        </Button>
      </div>
    </form>
  )
}

