'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { SupplierForm } from './supplier-form'
import { SupplierDetails } from './supplier-details'
import { formatCurrency } from '@/lib/utils'
import { Search, Plus, Edit, Trash2, Eye, Mail, Phone } from 'lucide-react'
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

  if (isLoading) {
    return <div>Cargando proveedores...</div>
  }

  const { suppliers, pagination } = data || { suppliers: [], pagination: { totalPages: 1 } }

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

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Contacto</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Teléfono</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {suppliers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-gray-500">
                  No hay proveedores
                </TableCell>
              </TableRow>
            ) : (
              suppliers.map((supplier: any) => (
                <TableRow key={supplier.id}>
                  <TableCell className="font-medium">{supplier.name}</TableCell>
                  <TableCell>
                    {supplier.taxId && (
                      <div className="text-sm text-gray-600">NIT: {supplier.taxId}</div>
                    )}
                  </TableCell>
                  <TableCell>
                    {supplier.email ? (
                      <div className="flex items-center gap-1 text-sm">
                        <Mail className="h-3 w-3" />
                        {supplier.email}
                      </div>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {supplier.phone ? (
                      <div className="flex items-center gap-1 text-sm">
                        <Phone className="h-3 w-3" />
                        {supplier.phone}
                      </div>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {supplier.active ? (
                      <span className="px-2 py-1 text-xs bg-green-100 text-green-800 rounded">Activo</span>
                    ) : (
                      <span className="px-2 py-1 text-xs bg-gray-100 text-gray-800 rounded">Inactivo</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleView(supplier)}
                        title="Ver detalles"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(supplier)}
                        title="Editar"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(supplier)}
                        title="Desactivar"
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

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
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
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
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Detalles del Proveedor</DialogTitle>
            </DialogHeader>
            <SupplierDetails supplierData={viewSupplier} />
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}

