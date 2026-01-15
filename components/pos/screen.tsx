'use client'

import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatCurrency } from '@/lib/utils'
import { useToast } from '@/components/ui/toast'
import { Search, Plus, Minus, Trash2, ShoppingCart } from 'lucide-react'

interface CartItem {
  productId: string
  productName: string
  quantity: number
  unitPrice: number
  discount: number
  taxRate: number
  subtotal: number
}

async function searchProducts(query: string) {
  const res = await fetch(`/api/products?search=${encodeURIComponent(query)}&limit=10`)
  if (!res.ok) throw new Error('Failed to search products')
  const data = await res.json()
  return data.products
}

async function fetchWarehouses() {
  const res = await fetch('/api/warehouses')
  if (!res.ok) throw new Error('Failed to fetch warehouses')
  return res.json()
}

// NOTE: Componente legacy (no usado). El POS activo vive en `components/pos/pos-screen.tsx`.
export function POSScreen() {
  const { toast } = useToast()
  const [searchQuery, setSearchQuery] = useState('')
  const [cart, setCart] = useState<CartItem[]>([])
  const [selectedWarehouse, setSelectedWarehouse] = useState<string>('')
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'CARD' | 'TRANSFER'>('CASH')
  const [cashReceived, setCashReceived] = useState('')
  const [customerId, setCustomerId] = useState('')
  const queryClient = useQueryClient()

  const { data: warehouses = [] } = useQuery({
    queryKey: ['warehouses'],
    queryFn: fetchWarehouses,
  })

  useEffect(() => {
    if (warehouses.length > 0 && !selectedWarehouse) {
      setSelectedWarehouse(warehouses[0].id)
    }
  }, [warehouses, selectedWarehouse])

  const { data: searchResults = [], isLoading: searching } = useQuery({
    queryKey: ['product-search', searchQuery],
    queryFn: () => searchProducts(searchQuery),
    enabled: searchQuery.length > 2,
  })

  const saleMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch('/api/pos/sale', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to create sale')
      }
      return res.json()
    },
    onSuccess: (data) => {
      toast(`Venta completada! Orden: ${data.orderNumber}, Factura: ${data.invoiceNumber}, Total: ${formatCurrency(data.total)}${data.change > 0 ? `, Cambio: ${formatCurrency(data.change)}` : ''}`, 'success')
      setCart([])
      setSearchQuery('')
      setCashReceived('')
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] })
    },
  })

  const addToCart = (product: any) => {
    const existing = cart.find(item => item.productId === product.id)
    if (existing) {
      setCart(cart.map(item =>
        item.productId === product.id
          ? { ...item, quantity: item.quantity + 1 }
          : item
      ))
    } else {
      setCart([...cart, {
        productId: product.id,
        productName: product.name,
        quantity: 1,
        unitPrice: product.price,
        discount: 0,
        taxRate: product.taxRate,
        subtotal: product.price * (1 + product.taxRate / 100),
      }])
    }
    setSearchQuery('')
  }

  const updateQuantity = (productId: string, delta: number) => {
    setCart(cart.map(item => {
      if (item.productId === productId) {
        const newQty = Math.max(1, item.quantity + delta)
        const subtotal = newQty * item.unitPrice * (1 - item.discount / 100) * (1 + item.taxRate / 100)
        return { ...item, quantity: newQty, subtotal }
      }
      return item
    }))
  }

  const removeFromCart = (productId: string) => {
    setCart(cart.filter(item => item.productId !== productId))
  }

  const calculateTotal = () => {
    return cart.reduce((sum, item) => sum + item.subtotal, 0)
  }

  const handleCheckout = () => {
    if (cart.length === 0) {
      toast('El carrito está vacío', 'warning')
      return
    }

    if (!selectedWarehouse) {
      toast('Seleccione un almacén', 'warning')
      return
    }

    if (paymentMethod === 'CASH' && (!cashReceived || parseFloat(cashReceived) < calculateTotal())) {
      toast('El efectivo recibido debe ser mayor o igual al total', 'warning')
      return
    }

    saleMutation.mutate({
      customerId: customerId || undefined,
      warehouseId: selectedWarehouse,
      items: cart.map(item => ({
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        discount: item.discount,
        taxRate: item.taxRate,
      })),
      paymentMethod,
      discount: 0,
      cashReceived: paymentMethod === 'CASH' ? parseFloat(cashReceived) : undefined,
    })
  }

  const total = calculateTotal()
  const change = paymentMethod === 'CASH' && cashReceived
    ? Math.max(0, parseFloat(cashReceived) - total)
    : 0

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Buscar Producto</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Buscar por nombre, SKU o código de barras..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && searchResults.length > 0) {
                    addToCart(searchResults[0])
                  }
                }}
              />
            </div>
            {searchQuery.length > 2 && (
              <div className="mt-2 border rounded-lg max-h-60 overflow-y-auto">
                {searching ? (
                  <div className="p-4 text-center text-gray-500">Buscando...</div>
                ) : searchResults.length === 0 ? (
                  <div className="p-4 text-center text-gray-500">No se encontraron productos</div>
                ) : (
                  <Table>
                    <TableBody>
                      {searchResults.map((product: any) => (
                        <TableRow
                          key={product.id}
                          className="cursor-pointer hover:bg-gray-50"
                          onClick={() => addToCart(product)}
                        >
                          <TableCell className="font-medium">{product.name}</TableCell>
                          <TableCell>{product.sku}</TableCell>
                          <TableCell>{formatCurrency(product.price)}</TableCell>
                          <TableCell>
                            <Button size="sm" variant="outline">
                              <Plus className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5" />
              Carrito ({cart.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {cart.length === 0 ? (
              <div className="text-center text-gray-500 py-8">
                El carrito está vacío
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Producto</TableHead>
                    <TableHead>Cantidad</TableHead>
                    <TableHead>Precio</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cart.map((item) => (
                    <TableRow key={item.productId}>
                      <TableCell className="font-medium">{item.productName}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => updateQuantity(item.productId, -1)}
                          >
                            <Minus className="h-4 w-4" />
                          </Button>
                          <span>{item.quantity}</span>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => updateQuantity(item.productId, 1)}
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell>{formatCurrency(item.unitPrice)}</TableCell>
                      <TableCell>{formatCurrency(item.subtotal)}</TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => removeFromCart(item.productId)}
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Pago</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium">Almacén</label>
              <select
                value={selectedWarehouse}
                onChange={(e) => setSelectedWarehouse(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                {warehouses.map((wh: any) => (
                  <option key={wh.id} value={wh.id}>{wh.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-sm font-medium">Método de Pago</label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as any)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="CASH">Efectivo</option>
                <option value="CARD">Tarjeta</option>
                <option value="TRANSFER">Transferencia</option>
              </select>
            </div>

            {paymentMethod === 'CASH' && (
              <div>
                <label className="text-sm font-medium">Efectivo Recibido</label>
                <Input
                  type="number"
                  step="0.01"
                  value={cashReceived}
                  onChange={(e) => setCashReceived(e.target.value)}
                  placeholder="0.00"
                />
              </div>
            )}

            <div className="border-t pt-4 space-y-2">
              <div className="flex justify-between text-lg font-bold">
                <span>Total:</span>
                <span>{formatCurrency(total)}</span>
              </div>
              {paymentMethod === 'CASH' && change > 0 && (
                <div className="flex justify-between text-green-600">
                  <span>Cambio:</span>
                  <span>{formatCurrency(change)}</span>
                </div>
              )}
            </div>

            <Button
              className="w-full"
              size="lg"
              onClick={handleCheckout}
              disabled={cart.length === 0 || saleMutation.isPending}
            >
              {saleMutation.isPending ? 'Procesando...' : 'Finalizar Venta'}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

