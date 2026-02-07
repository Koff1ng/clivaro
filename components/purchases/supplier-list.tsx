'use client'

import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { SupplierForm } from './supplier-form'
import { SupplierDetails } from './supplier-details'
import { formatCurrency } from '@/lib/utils'
import { Search, Plus, Edit, Trash2, Eye, Mail, Phone, Loader2, Building2, FileText } from 'lucide-react'
import { useToast } from '@/components/ui/toast'

async function fetchSuppliers(page: number, search: string) {
  const params = new URLSearchParams({
    page: page.toString(),
    limit: '50',
  })
  if (search) params.append('search', search)

  const res = await fetch(`/api/suppliers?${params}`)
  if (!res.ok) throw new Error('Failed to fetch suppliers')
  return res.json()
}

export function SupplierList() {
  const { toast } = useToast()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [selectedSupplier, setSelectedSupplier] = useState<any>(null)
  const [viewSupplier, setViewSupplier] = useState<any>(null)
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['suppliers', page, search],
    queryFn: () => fetchSuppliers(page, search),
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/suppliers/${id}`, {
        method: 'DELETE',
      })
      if (!res.ok) throw new Error('Failed to delete supplier')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] })
    },
  })

  const handleEdit = (supplier: any) => {
    setSelectedSupplier(supplier)
    setIsFormOpen(true)
  }

  const handleDelete = async (supplier: any) => {
    if (confirm(`¿Estás seguro de desactivar a ${supplier.name}?`)) {
      await deleteMutation.mutateAsync(supplier.id)
    }
  }

  const handleView = async (supplier: any) => {
    try {
      const res = await fetch(`/api/suppliers/${supplier.id}`)

      const data = await res.json().catch(() => null)

      if (!res.ok) {
        const errorMessage = data?.error || data?.message || `Error ${res.status}: ${res.statusText}`
        throw new Error(errorMessage)
      }

      if (!data || !data.supplier) {
        throw new Error('No se recibieron los datos del proveedor correctamente')
      }

      setViewSupplier(data)
    } catch (error: any) {
      const errorMessage = error?.message || 'Error desconocido al cargar los detalles del proveedor'
      toast(errorMessage, 'error')
    }
  }

  const { suppliers, pagination } = useMemo(() => {
    return data || { suppliers: [], pagination: { totalPages: 1 } }
  }, [data])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Buscar proveedores..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
            className="pl-10"
          />
        </div>
        <Button onClick={() => {
          setSelectedSupplier(null)
          setIsFormOpen(true)
        }}>
          <Plus className="h-4 w-4 mr-2" />
          Nuevo Proveedor
        </Button>
      </div>

      {isLoading && suppliers.length === 0 ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground mr-2" />
          <span className="text-muted-foreground">Cargando proveedores...</span>
        </div>
      ) : (
        <div className="border rounded-2xl bg-card/80 backdrop-blur-sm shadow-sm overflow-hidden">
          <Table>
            <TableHeader className="bg-gray-50 dark:bg-gray-800/50">
              <TableRow>
                <TableHead className="py-3 px-4 font-semibold text-sm">Nombre</TableHead>
                <TableHead className="py-3 px-4 font-semibold text-sm">Contacto</TableHead>
                <TableHead className="py-3 px-4 font-semibold text-sm">Email</TableHead>
                <TableHead className="py-3 px-4 font-semibold text-sm">Teléfono</TableHead>
                <TableHead className="py-3 px-4 font-semibold text-sm">Estado</TableHead>
                <TableHead className="py-3 px-4 font-semibold text-sm w-[120px]">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {suppliers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-gray-500 py-8">
                    No hay proveedores
                  </TableCell>
                </TableRow>
              ) : (
                suppliers.map((supplier: any) => (
                  <TableRow key={supplier.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/50 border-b transition-colors">
                    <TableCell className="py-3 px-4 font-medium">{supplier.name}</TableCell>
                    <TableCell className="py-3 px-4">
                      {supplier.taxId && (
                        <div className="text-sm text-gray-600 dark:text-gray-400">NIT: {supplier.taxId}</div>
                      )}
                    </TableCell>
                    <TableCell className="py-3 px-4">
                      {supplier.email ? (
                        <div className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-300">
                          <Mail className="h-3 w-3" />
                          {supplier.email}
                        </div>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </TableCell>
                    <TableCell className="py-3 px-4">
                      {supplier.phone ? (
                        <div className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-300">
                          <Phone className="h-3 w-3" />
                          {supplier.phone}
                        </div>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </TableCell>
                    <TableCell className="py-3 px-4">
                      {supplier.active ? (
                        <span className="px-2 py-0.5 text-xs bg-green-100 text-green-800 rounded-full border border-green-200">Activo</span>
                      ) : (
                        <span className="px-2 py-0.5 text-xs bg-gray-100 text-gray-800 rounded-full border border-gray-200">Inactivo</span>
                      )}
                    </TableCell>
                    <TableCell className="py-3 px-4">
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleView(supplier)}
                          className="h-8 w-8 p-0 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full"
                          title="Ver detalles"
                        >
                          <Eye className="h-4 w-4 text-gray-500" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(supplier)}
                          className="h-8 w-8 p-0 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full"
                          title="Editar"
                        >
                          <Edit className="h-4 w-4 text-gray-500" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(supplier)}
                          className="h-8 w-8 p-0 hover:bg-red-50 text-red-500 rounded-full"
                          title="Desactivar"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-600">
            Página {pagination.page} de {pagination.totalPages} ({pagination.total} proveedores)
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              Anterior
            </Button>
            <Button
              variant="outline"
              onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))}
              disabled={page === pagination.totalPages}
            >
              Siguiente
            </Button>
          </div>
        </div>
      )}

      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="w-auto sm:max-w-fit max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              {selectedSupplier ? 'Editar Proveedor' : 'Nuevo Proveedor'}
            </DialogTitle>
          </DialogHeader>
          <SupplierForm
            supplier={selectedSupplier}
            onSuccess={() => {
              setIsFormOpen(false)
              setSelectedSupplier(null)
            }}
          />
        </DialogContent>
      </Dialog>

      {viewSupplier && (
        <Dialog open={!!viewSupplier} onOpenChange={() => setViewSupplier(null)}>
          <DialogContent className="w-auto sm:max-w-fit max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Detalles del Proveedor
              </DialogTitle>
            </DialogHeader>
            <SupplierDetails supplierData={viewSupplier} />
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}

