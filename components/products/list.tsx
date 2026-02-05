'use client'

import React, { useState, useMemo, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import dynamic from 'next/dynamic'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { useDebounce } from '@/lib/hooks/use-debounce'
import { formatCurrency } from '@/lib/utils'
import { Plus, Search, Edit, Loader2 } from 'lucide-react'

// Lazy load heavy form component
const ProductForm = dynamic(() => import('./form').then(mod => ({ default: mod.ProductForm })), {
  loading: () => <div className="p-4">Cargando formulario...</div>,
})

// ...

async function fetchProducts(page: number, search: string, category: string, hasRecipe: string) {
  const params = new URLSearchParams({
    page: page.toString(),
    limit: '20',
  })
  if (search) params.append('search', search)
  if (category && category !== 'all') params.append('category', category)
  if (hasRecipe && hasRecipe !== 'all') params.append('hasRecipe', hasRecipe)

  const res = await fetch(`/api/products?${params}`)
  if (!res.ok) throw new Error('Failed to fetch products')
  return res.json()
}

export function ProductsList() {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('all')
  const [hasRecipe, setHasRecipe] = useState('all')
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState<any>(null)
  const queryClient = useQueryClient()

  // Debounce search to avoid excessive queries
  const debouncedSearch = useDebounce(search, 500)

  const { data, isLoading } = useQuery({
    queryKey: ['products', page, debouncedSearch, category, hasRecipe],
    queryFn: () => fetchProducts(page, debouncedSearch, category, hasRecipe),
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 5 * 60 * 1000, // 5 minutes cache
    placeholderData: (prev) => prev, // Keep previous data while loading new page
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/products/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete product')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] })
      queryClient.invalidateQueries({ queryKey: ['activity-feed'] })
    },
  })

  const handleEdit = useCallback((product: any) => {
    setEditingProduct(product)
    setIsDialogOpen(true)
  }, [])

  const handleClose = useCallback(() => {
    setIsDialogOpen(false)
    setEditingProduct(null)
  }, [])

  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value)
    setPage(1)
  }, [])

  const handleCategoryChange = useCallback((value: string) => {
    setCategory(value)
    setPage(1)
  }, [])

  const handleHasRecipeChange = useCallback((value: string) => {
    setHasRecipe(value)
    setPage(1)
  }, [])

  const { products, pagination } = useMemo(() => {
    return data || { products: [], pagination: { totalPages: 1 } }
  }, [data])

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Buscar por nombre, SKU o código de barras..."
            value={search}
            onChange={handleSearchChange}
            className="pl-10"
          />
        </div>

        <Select value={category} onValueChange={handleCategoryChange}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Categoría" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            <SelectItem value="Carnes">Carnes</SelectItem>
            <SelectItem value="Hamburguesas">Hamburguesas</SelectItem>
            <SelectItem value="Perros Calientes">Perros Calientes</SelectItem>
            <SelectItem value="Acompañamientos">Acompañamientos</SelectItem>
            <SelectItem value="Bebidas">Bebidas</SelectItem>
            <SelectItem value="Panadería">Panadería</SelectItem>
            <SelectItem value="Lácteos">Lácteos</SelectItem>
            <SelectItem value="Verduras">Verduras</SelectItem>
            <SelectItem value="Salsas">Salsas</SelectItem>
            <SelectItem value="Despensa">Despensa</SelectItem>
          </SelectContent>
        </Select>

        <Select value={hasRecipe} onValueChange={handleHasRecipeChange}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Tipo de Stock" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="true">Con Receta (Virtual)</SelectItem>
            <SelectItem value="false">Sin Receta (Físico)</SelectItem>
          </SelectContent>
        </Select>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => setEditingProduct(null)} className="w-full sm:w-auto">
              <Plus className="h-4 w-4 mr-2" />
              Nuevo Item
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingProduct ? 'Editar Item' : 'Nuevo Item'}
              </DialogTitle>
            </DialogHeader>
            <ProductForm
              product={editingProduct}
              onSuccess={() => {
                handleClose()
                queryClient.invalidateQueries({ queryKey: ['products'] })
                queryClient.invalidateQueries({ queryKey: ['activity-feed'] })
              }}
            />
          </DialogContent>
        </Dialog>
      </div>

      {isLoading && products.length === 0 ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground mr-2" />
          <span className="text-muted-foreground">Cargando items...</span>
        </div>
      ) : (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>SKU</TableHead>
                <TableHead>Nombre</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Categoría</TableHead>
                <TableHead>Unidad</TableHead>
                <TableHead>Costo</TableHead>
                <TableHead>Precio</TableHead>
                <TableHead>Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-gray-500">
                    No hay items registrados
                  </TableCell>
                </TableRow>
              ) : (
                products.map((product: any) => (
                  <ProductRow
                    key={product.id}
                    product={product}
                    onEdit={handleEdit}
                  />
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {pagination.totalPages > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-sm text-gray-600 text-center sm:text-left">
            Página {pagination.page} de {pagination.totalPages}
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              size="sm"
            >
              Anterior
            </Button>
            <Button
              variant="outline"
              onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))}
              disabled={page === pagination.totalPages}
              size="sm"
            >
              Siguiente
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

// Memoized row component to prevent unnecessary re-renders
const ProductRow = React.memo(({ product, onEdit }: { product: any; onEdit: (product: any) => void }) => (
  <TableRow>
    <TableCell>{product.sku}</TableCell>
    <TableCell className="font-medium">
      <div>{product.name}</div>
      {product.enableRecipeConsumption && (
        <div className="flex gap-1 mt-1">
          <span className="text-[10px] bg-blue-100 text-blue-700 px-1 rounded font-bold uppercase">Con Receta</span>
        </div>
      )}
    </TableCell>
    <TableCell>
      <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">
        {product.productType || 'RETAIL'}
      </span>
    </TableCell>
    <TableCell>{product.category || '-'}</TableCell>
    <TableCell>{product.unitOfMeasure}</TableCell>
    <TableCell>{formatCurrency(product.cost)}</TableCell>
    <TableCell>{formatCurrency(product.price)}</TableCell>
    <TableCell>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => onEdit(product)}
      >
        <Edit className="h-4 w-4" />
      </Button>
    </TableCell>
  </TableRow>
))

ProductRow.displayName = 'ProductRow'

