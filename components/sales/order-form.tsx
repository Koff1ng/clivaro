'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'
import { formatCurrency } from '@/lib/utils'
import { Search, Plus, Trash2, Check, ChevronsUpDown, Loader2, UserPlus } from 'lucide-react'
import { useToast } from '@/components/ui/toast'
import { cn } from '@/lib/utils'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { CustomerForm } from '@/components/crm/customer-form'
import { Badge } from '@/components/ui/badge'
import { TaxSelector, TaxRate } from '@/components/pos/tax-selector'

interface OrderFormProps {
    initialData?: any
    isEditing?: boolean
}

export function OrderForm({ initialData, isEditing = false }: OrderFormProps) {
    const router = useRouter()
    const { toast } = useToast()
    const queryClient = useQueryClient()

    const [customerId, setCustomerId] = useState(initialData?.customerId || '')
    const [items, setItems] = useState<any[]>(initialData?.items?.map((i: any) => ({
        ...i,
        productName: i.product?.name || i.productName, // Handle API vs Form struct
        taxes: i.taxes || (i.taxRate ? [{ id: 'default', name: 'Impuesto', rate: i.taxRate, type: 'IVA' }] : []),
        subtotal: i.unitPrice * i.quantity * (1 - i.discount / 100) * (1 + i.taxRate / 100)
    })) || [])
    const [notes, setNotes] = useState(initialData?.notes || '')

    // Customer Creation State
    const [isCreateCustomerOpen, setIsCreateCustomerOpen] = useState(false)

    // Product Search State
    const [productSearch, setProductSearch] = useState('')
    const [productResults, setProductResults] = useState<any[]>([])
    const [isSearchingProducts, setIsSearchingProducts] = useState(false)

    // Customer Search State
    const [customerSearch, setCustomerSearch] = useState('')

    // Fetch Customers (Real-time)
    const { data: customers = [], isFetching: isSearchingCustomers, refetch: refetchCustomers } = useQuery({
        queryKey: ['customers', customerSearch],
        queryFn: async () => {
            const params = new URLSearchParams({ limit: '50' })
            if (customerSearch) params.append('search', customerSearch)
            const res = await fetch(`/api/customers?${params}`)
            if (!res.ok) return []
            const data = await res.json()
            return data.customers || []
        },
        // Remove enabled: customerOpen to allow pre-fetching or always active
        staleTime: 60000,
    })

    // Search Products
    useEffect(() => {
        if (productSearch.length < 2) {
            setProductResults([])
            return
        }
        setIsSearchingProducts(true)
        const timer = setTimeout(async () => {
            try {
                const res = await fetch(`/api/pos/products?search=${productSearch}`)
                if (res.ok) {
                    const data = await res.json()
                    setProductResults(data.products || [])
                }
            } finally {
                setIsSearchingProducts(false)
            }
        }, 300)
        return () => clearTimeout(timer)
    }, [productSearch])

    const addItem = (product: any) => {
        const existing = items.find(i => i.productId === product.id)
        if (existing) {
            updateItem(product.id, 'quantity', existing.quantity + 1)
        } else {
            setItems([...items, {
                productId: product.id,
                productName: product.name,
                quantity: 1,
                unitPrice: product.price,
                discount: 0,
                taxRate: product.taxRate || 0, // Ensure taxRate exists
                taxes: product.taxRate ? [{ id: 'default', name: 'IVA Default', rate: product.taxRate, type: 'IVA' }] : []
            }])
        }
        setProductSearch('')
        setProductResults([])
    }

    const updateItem = (productId: string, field: string, value: any) => {
        setItems(items.map(item => {
            if (item.productId === productId) {
                return { ...item, [field]: value }
            }
            return item
        }))
    }

    const handleTaxesChange = (productId: string, newTaxes: TaxRate[]) => {
        const totalRate = newTaxes.reduce((sum, t) => {
            if (t.type.startsWith('RETE')) return sum - t.rate
            return sum + t.rate
        }, 0)

        // Ensure non-negative? Actually rete can make it negative total tax technically but usually just reduces base. 
        // Logic: (1 + rate/100). If rate is negative, it reduces price. 
        // OrderForm logic: subtotal += base; tax += (base-disc)*(rate/100).
        // If rate is negative (retention only?), tax is negative.
        // Usually retention is handled separately but here we map to single taxRate.
        // Let's assume standard behavior: pure mapping.

        setItems(items.map(item => {
            if (item.productId === productId) {
                return {
                    ...item,
                    taxes: newTaxes,
                    taxRate: totalRate
                }
            }
            return item
        }))
    }

    const removeItem = (productId: string) => {
        setItems(items.filter(i => i.productId !== productId))
    }

    const calculateTotals = () => {
        let subtotal = 0
        let discount = 0
        let tax = 0

        items.forEach(item => {
            const base = item.quantity * item.unitPrice
            const disc = base * (item.discount / 100)
            const tx = (base - disc) * (item.taxRate / 100)

            subtotal += base
            discount += disc
            tax += tx
        })

        return { subtotal, discount, tax, total: subtotal - discount + tax }
    }

    const totals = calculateTotals()

    const mutation = useMutation({
        mutationFn: async (data: any) => {
            const url = isEditing && initialData?.id
                ? `/api/sales-orders/${initialData.id}`
                : '/api/sales-orders'

            const method = isEditing ? 'PUT' : 'POST'

            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            })

            if (!res.ok) {
                const err = await res.json()
                throw new Error(err.error || 'Error al guardar orden')
            }
            return res.json()
        },
        onSuccess: (data) => {
            toast('Orden guardada exitosamente', 'success') // Fix: toast variant
            // Pre-seed query cache to avoid immediate fetch race condition
            queryClient.setQueryData(['sales-order', data.id], data)
            router.push(`/sales/orders/${data.id}`)
        },
        onError: (err: any) => {
            toast(err.message, 'error') // Fix: toast variant
        }
    })

    const handleSubmit = () => {
        if (!customerId) {
            toast('Selecciona un cliente', 'warning') // Fix: toast variant
            return
        }
        if (items.length === 0) {
            toast('Agrega al menos un producto', 'warning') // Fix: toast variant
            return
        }

        mutation.mutate({
            customerId,
            notes,
            items: items.map(i => ({
                productId: i.productId,
                variantId: i.variantId,
                quantity: Number(i.quantity),
                unitPrice: Number(i.unitPrice),
                discount: Number(i.discount),
                taxRate: Number(i.taxRate)
            }))
        })
    }

    const handleCustomerCreated = () => {
        setIsCreateCustomerOpen(false)
        refetchCustomers().then((res) => {
            // Optimistically try to select the new customer if possible (currently just refetching)
            // Ideally backend returns the new customer ID or we know the name to search/filter
            // For now, just refetching ensures they appear in the list immediately
            toast('Cliente creado y listo para seleccionar', 'success') // Fix: toast variant
        })
    }

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Customer Selection */}
                <div className="space-y-4 border p-4 rounded-lg bg-card">
                    <h3 className="font-semibold flex items-center gap-2">
                        <Check className="h-4 w-4" /> Cliente
                    </h3>

                    <SearchableSelect
                        options={customers.map((c: any) => ({ id: c.id, label: c.name }))}
                        value={customerId}
                        onChange={setCustomerId}
                        onSearch={setCustomerSearch}
                        placeholder="Buscar cliente..."
                        loading={isSearchingCustomers}
                        onCreate={() => setIsCreateCustomerOpen(true)}
                        createLabel="Crear nuevo cliente"
                    />
                </div>

                {/* Notes */}
                <div className="space-y-2">
                    <label className="text-sm font-medium">Notas</label>
                    <Textarea
                        placeholder="Observaciones de la orden..."
                        value={notes}
                        onChange={e => setNotes(e.target.value)}
                        className="h-[100px]"
                    />
                </div>
            </div>

            {/* Items Section */}
            {/* Items Section */}
            <div className="border rounded-lg bg-card overflow-hidden">
                <div className="p-4 border-b bg-muted/30 flex justify-between items-center">
                    <h3 className="font-semibold">Items</h3>
                    <div className="relative w-80">
                        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Buscar item (nombre, sku)..."
                            value={productSearch}
                            onChange={e => setProductSearch(e.target.value)}
                            className="pl-8"
                        />
                        {isSearchingProducts && (
                            <div className="absolute right-2 top-2.5">
                                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                            </div>
                        )}
                        {productResults.length > 0 && (
                            <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-popover border rounded-md shadow-lg max-h-80 overflow-y-auto">
                                {productResults.map((p) => (
                                    <div
                                        key={p.id}
                                        className="p-3 hover:bg-muted cursor-pointer border-b last:border-0"
                                        onClick={() => addItem(p)}
                                    >
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <div className="font-medium">{p.name}</div>
                                                <div className="text-xs text-muted-foreground">SKU: {p.sku || 'N/A'}</div>
                                            </div>
                                            <div className="text-right">
                                                <div className="font-bold">{formatCurrency(p.price)}</div>
                                                <Badge
                                                    variant={p.stock > 0 ? 'outline' : 'destructive'}
                                                    className="text-[10px] h-5 px-1.5"
                                                >
                                                    Stock: {p.stock}
                                                </Badge>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-[40%]">Item</TableHead>
                            <TableHead className="w-[12%] text-right">Cantidad</TableHead>
                            <TableHead className="w-[12%] text-right">Precio</TableHead>
                            <TableHead className="w-[12%] text-right">Impuesto</TableHead>
                            <TableHead className="w-[10%] text-right">Desc %</TableHead>
                            <TableHead className="w-[12%] text-right">Total</TableHead>
                            <TableHead className="w-[9%]"></TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {items.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                                    Agrega productos a la orden
                                </TableCell>
                            </TableRow>
                        ) : items.map(item => (
                            <TableRow key={item.productId}>
                                <TableCell>{item.productName}</TableCell>
                                <TableCell>
                                    <Input
                                        type="number"
                                        min="0.1"
                                        className="text-right h-8"
                                        value={item.quantity}
                                        onChange={e => updateItem(item.productId, 'quantity', parseFloat(e.target.value))}
                                    />
                                </TableCell>
                                <TableCell>
                                    <Input
                                        type="number"
                                        min="0"
                                        className="text-right h-8"
                                        value={item.unitPrice}
                                        onChange={e => updateItem(item.productId, 'unitPrice', parseFloat(e.target.value))}
                                    />
                                </TableCell>
                                <TableCell className="text-right">
                                    <TaxSelector
                                        selectedTaxes={item.taxes || []}
                                        onTaxesChange={(taxes) => handleTaxesChange(item.productId, taxes)}
                                    />
                                </TableCell>
                                <TableCell>
                                    <Input
                                        type="number"
                                        min="0"
                                        max="100"
                                        className="text-right h-8"
                                        value={item.discount}
                                        onChange={e => updateItem(item.productId, 'discount', parseFloat(e.target.value))}
                                    />
                                </TableCell>
                                <TableCell className="text-right font-medium">
                                    {formatCurrency(
                                        item.quantity * item.unitPrice * (1 - item.discount / 100) * (1 + item.taxRate / 100)
                                    )}
                                </TableCell>
                                <TableCell className="text-right">
                                    <Button variant="ghost" size="sm" onClick={() => removeItem(item.productId)}>
                                        <Trash2 className="h-4 w-4 text-red-500" />
                                    </Button>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>

                {/* Totals Footer */}
                <div className="p-4 bg-muted/10 border-t items-end flex flex-col gap-2">
                    <div className="flex w-64 justify-between text-sm">
                        <span>Subtotal:</span>
                        <span>{formatCurrency(totals.subtotal)}</span>
                    </div>
                    <div className="flex w-64 justify-between text-sm text-muted-foreground">
                        <span>Descuento:</span>
                        <span>-{formatCurrency(totals.discount)}</span>
                    </div>
                    <div className="flex w-64 justify-between text-sm text-muted-foreground">
                        <span>Impuestos:</span>
                        <span>+{formatCurrency(totals.tax)}</span>
                    </div>
                    <div className="flex w-64 justify-between font-bold text-lg pt-2 border-t mt-2">
                        <span>Total:</span>
                        <span>{formatCurrency(totals.total)}</span>
                    </div>
                </div>
            </div>

            <div className="flex justify-end gap-4">
                <Button variant="outline" onClick={() => router.back()}>Cancelar</Button>
                <Button onClick={handleSubmit} disabled={mutation.isPending}>
                    {mutation.isPending ? 'Guardando...' : 'Guardar Orden'}
                </Button>
            </div>

            <Dialog open={isCreateCustomerOpen} onOpenChange={setIsCreateCustomerOpen}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <UserPlus className="h-5 w-5" />
                            Crear Nuevo Cliente
                        </DialogTitle>
                    </DialogHeader>
                    <CustomerForm customer={null} onSuccess={handleCustomerCreated} />
                </DialogContent>
            </Dialog>
        </div>
    )
}
