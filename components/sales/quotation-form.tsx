'use client'

import { useState, useEffect } from 'react'
import { useForm, useFieldArray, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query'
import { useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { DatePicker } from '@/components/ui/date-picker'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { formatCurrency, toDateInputValue } from '@/lib/utils'
import { useToast } from '@/components/ui/toast'
import { useDebounce } from '@/lib/hooks/use-debounce'
import { Plus, Trash2 } from 'lucide-react'

const quotationItemSchema = z.object({
  productId: z.string().min(1, 'Producto requerido'),
  variantId: z.string().optional().nullable(),
  quantity: z.number().positive('Cantidad debe ser mayor a 0'),
  unitPrice: z.number().min(0, 'Precio debe ser mayor o igual a 0'),
  discount: z.number().min(0).max(100).default(0),
  taxRate: z.number().min(0).max(100),
})

const quotationSchema = z.object({
  customerId: z.string().optional(),
  customerName: z.string().optional(),
  customerEmail: z.string().email().optional().or(z.literal('')),
  customerPhone: z.string().optional(),
  customerTaxId: z.string().optional(),
  leadId: z.string().optional(),
  items: z.array(quotationItemSchema).min(1, 'Debe agregar al menos un producto'),
  discount: z.number().min(0).default(0),
  validUntil: z.string().optional(),
  notes: z.string().optional(),
}).refine((data) => data.customerId || data.customerName, {
  message: 'Debe seleccionar un cliente o ingresar el nombre del cliente',
  path: ['customerName'],
})

type QuotationFormData = z.infer<typeof quotationSchema>

async function fetchProducts(search?: string) {
  const params = new URLSearchParams({ limit: '100' }) // Reducido de 1000 a 100 para mejor rendimiento
  if (search) params.append('search', search)
  const res = await fetch(`/api/products?${params}`)
  if (!res.ok) return []
  const data = await res.json()
  return data.products || []
}

export function QuotationForm({ quotation, customers, onSuccess }: { quotation: any; customers: any[]; onSuccess: () => void }) {
  const { toast } = useToast()
  const searchParams = useSearchParams()
  const [loading, setLoading] = useState(false)
  const queryClient = useQueryClient()
  
  // Búsqueda de productos para optimizar carga (reducido de 1000 a 100 items)
  const [productSearch, setProductSearch] = useState('')
  const debouncedProductSearch = useDebounce(productSearch, 300)
  
  const { data: products = [] } = useQuery({
    queryKey: ['quotation-products', debouncedProductSearch],
    queryFn: () => fetchProducts(debouncedProductSearch || undefined),
    staleTime: 5 * 60 * 1000, // 5 minutes - products don't change frequently during form editing
    gcTime: 10 * 60 * 1000,
  })

  const [createNewCustomer, setCreateNewCustomer] = useState(false)
  
  const { register, handleSubmit, formState: { errors }, control, watch, setValue } = useForm<QuotationFormData>({
    resolver: zodResolver(quotationSchema),
    defaultValues: {
      customerId: '',
      customerName: '',
      customerEmail: '',
      customerPhone: '',
      customerTaxId: '',
      leadId: searchParams?.get('leadId') || '',
      items: [],
      discount: 0,
      validUntil: '',
      notes: '',
    },
  })

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'items',
  })

  const watchedItems = watch('items')
  const watchedDiscount = watch('discount')

  // Si viene leadId desde URL, establecerlo
  useEffect(() => {
    const leadIdFromUrl = searchParams?.get('leadId')
    if (leadIdFromUrl && !quotation) {
      setValue('leadId', leadIdFromUrl)
    }
  }, [searchParams, setValue, quotation])

  useEffect(() => {
    if (quotation) {
      setValue('customerId', quotation.customerId)
      setValue('leadId', quotation.leadId || '')
      setValue('discount', quotation.discount || 0)
      setValue('validUntil', quotation.validUntil ? toDateInputValue(quotation.validUntil) : '')
      setValue('notes', quotation.notes || '')
      setCreateNewCustomer(false)
      if (quotation.items && quotation.items.length > 0) {
        setValue('items', quotation.items.map((item: any) => ({
          productId: item.productId,
          variantId: item.variantId || null,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          discount: item.discount || 0,
          taxRate: item.taxRate || 0,
        })))
      }
    }
  }, [quotation, setValue])

  const calculateTotals = () => {
    let subtotal = 0
    watchedItems.forEach((item: any) => {
      const itemSubtotal = (item.quantity || 0) * (item.unitPrice || 0) * (1 - (item.discount || 0) / 100)
      subtotal += itemSubtotal
    })
    const discount = watchedDiscount || 0
    const subtotalAfterDiscount = subtotal - discount
    const tax = watchedItems.reduce((sum: number, item: any) => {
      const itemSubtotal = (item.quantity || 0) * (item.unitPrice || 0) * (1 - (item.discount || 0) / 100)
      return sum + (itemSubtotal * (item.taxRate || 0) / 100)
    }, 0)
    const total = subtotalAfterDiscount + tax
    return { subtotal, discount, subtotalAfterDiscount, tax, total }
  }

  const totals = calculateTotals()

  const addItem = () => {
    append({
      productId: '',
      variantId: null,
      quantity: 1,
      unitPrice: 0,
      discount: 0,
      taxRate: 19,
    })
  }

  const handleProductChange = (index: number, productId: string) => {
    const product = products.find((p: any) => p.id === productId)
    if (product) {
      setValue(`items.${index}.productId`, productId)
      setValue(`items.${index}.unitPrice`, product.price)
      setValue(`items.${index}.taxRate`, product.taxRate || 19)
    }
  }

  const mutation = useMutation({
    mutationFn: async (data: QuotationFormData) => {
      const url = quotation ? `/api/quotations/${quotation.id}` : '/api/quotations'
      const method = quotation ? 'PUT' : 'POST'
      
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Error al guardar cotización')
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotations'] })
      queryClient.invalidateQueries({ queryKey: ['activity-feed'] })
      onSuccess()
    },
  })

  const onSubmit = async (data: QuotationFormData) => {
    setLoading(true)
    try {
      await mutation.mutateAsync(data)
    } catch (error: any) {
      toast(error.message || 'Error al guardar cotización', 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <input
              type="checkbox"
              id="createNewCustomer"
              checked={createNewCustomer}
              onChange={(e) => {
                setCreateNewCustomer(e.target.checked)
                if (e.target.checked) {
                  setValue('customerId', '')
                } else {
                  setValue('customerName', '')
                  setValue('customerEmail', '')
                  setValue('customerPhone', '')
                  setValue('customerTaxId', '')
                }
              }}
              className="h-4 w-4"
            />
            <Label htmlFor="createNewCustomer" className="cursor-pointer text-sm">
              Cliente nuevo (no registrado)
            </Label>
          </div>
          {!createNewCustomer ? (
            <>
              <Label htmlFor="customerId">Cliente *</Label>
              <Controller
                name="customerId"
                control={control}
                render={({ field }) => (
                  <SearchableSelect
                    options={customers.map((c: any) => ({ id: c.id, label: c.name }))}
                    value={field.value || ''}
                    onChange={field.onChange}
                    placeholder="Seleccione un cliente"
                    searchPlaceholder="Buscar cliente..."
                    className="w-full"
                  />
                )}
              />
              {errors.customerId && (
                <p className="text-sm text-red-500">{errors.customerId.message}</p>
              )}
            </>
          ) : (
            <div className="space-y-2">
              <div>
                <Label htmlFor="customerName">Nombre del Cliente *</Label>
                <Input
                  id="customerName"
                  {...register('customerName')}
                  placeholder="Nombre completo del cliente"
                />
                {errors.customerName && (
                  <p className="text-sm text-red-500">{errors.customerName.message}</p>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label htmlFor="customerEmail">Email</Label>
                  <Input
                    id="customerEmail"
                    type="email"
                    {...register('customerEmail')}
                    placeholder="email@ejemplo.com"
                  />
                </div>
                <div>
                  <Label htmlFor="customerPhone">Teléfono</Label>
                  <Input
                    id="customerPhone"
                    {...register('customerPhone')}
                    placeholder="+57 300 123 4567"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="customerTaxId">NIT / Identificación</Label>
                <Input
                  id="customerTaxId"
                  {...register('customerTaxId')}
                  placeholder="NIT o número de identificación"
                />
              </div>
            </div>
          )}
        </div>
        <div>
          <Label htmlFor="validUntil">Válida Hasta</Label>
          <Controller
            name="validUntil"
            control={control}
            render={({ field }) => (
              <DatePicker
                id="validUntil"
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
          <Label>Productos *</Label>
          <Button type="button" variant="outline" size="sm" onClick={addItem}>
            <Plus className="h-4 w-4 mr-2" />
            Agregar Producto
          </Button>
        </div>
        {errors.items && (
          <p className="text-sm text-red-500 mb-2">{errors.items.message}</p>
        )}
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Producto</TableHead>
                <TableHead>Cantidad</TableHead>
                <TableHead>Precio Unit.</TableHead>
                <TableHead>Descuento %</TableHead>
                <TableHead>IVA %</TableHead>
                <TableHead>Subtotal</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {fields.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-gray-500">
                    No hay productos. Agregue al menos uno.
                  </TableCell>
                </TableRow>
              ) : (
                fields.map((field, index) => {
                  const item = watchedItems[index]
                  const itemSubtotal = (item?.quantity || 0) * (item?.unitPrice || 0) * (1 - (item?.discount || 0) / 100)
                  const itemTax = itemSubtotal * ((item?.taxRate || 0) / 100)
                  const itemTotal = itemSubtotal + itemTax
                  
                  return (
                    <TableRow key={field.id}>
                      <TableCell>
                        <Controller
                          name={`items.${index}.productId`}
                          control={control}
                          render={({ field }) => (
                            <SearchableSelect
                              options={products.map((p: any) => ({ 
                                id: p.id, 
                                label: `${p.name} (${p.sku})` 
                              }))}
                              value={field.value || ''}
                              onChange={(value) => {
                                field.onChange(value)
                                handleProductChange(index, value)
                              }}
                              placeholder="Seleccione producto..."
                              searchPlaceholder="Buscar producto..."
                              className="w-full"
                            />
                          )}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          step="0.01"
                          {...register(`items.${index}.quantity`, { valueAsNumber: true })}
                          className="w-20"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          step="0.01"
                          {...register(`items.${index}.unitPrice`, { valueAsNumber: true })}
                          className="w-24"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          step="0.01"
                          {...register(`items.${index}.discount`, { valueAsNumber: true })}
                          className="w-20"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          step="0.01"
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
                          onClick={() => remove(index)}
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
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="discount">Descuento General (COP)</Label>
          <Input
            id="discount"
            type="number"
            step="0.01"
            {...register('discount', { valueAsNumber: true })}
            placeholder="0"
          />
        </div>
        <div>
          <Label htmlFor="notes">Notas</Label>
          <Input
            id="notes"
            {...register('notes')}
            placeholder="Notas adicionales..."
          />
        </div>
      </div>

      <div className="border-t pt-4">
        <div className="flex justify-end space-x-4 text-sm">
          <div className="text-right">
            <div className="text-gray-600 mb-1">Subtotal:</div>
            <div className="text-gray-600 mb-1">Descuento:</div>
            <div className="text-gray-600 mb-1">IVA:</div>
            <div className="font-bold text-lg">Total:</div>
          </div>
          <div className="text-right">
            <div className="mb-1">{formatCurrency(totals.subtotal)}</div>
            <div className="mb-1">{formatCurrency(totals.discount)}</div>
            <div className="mb-1">{formatCurrency(totals.tax)}</div>
            <div className="font-bold text-lg">{formatCurrency(totals.total)}</div>
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-4">
        <Button type="button" variant="outline" onClick={onSuccess}>
          Cancelar
        </Button>
        <Button type="submit" disabled={loading}>
          {loading ? 'Guardando...' : quotation ? 'Actualizar' : 'Crear Cotización'}
        </Button>
      </div>
    </form>
  )
}

