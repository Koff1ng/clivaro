'use client'

import React, { useState, useMemo, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import dynamic from 'next/dynamic'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { useDebounce } from '@/lib/hooks/use-debounce'
import { formatCurrency } from '@/lib/utils'
import { useToast } from '@/components/ui/toast'
import { Search, Plus, Edit, Trash2, Eye, Mail, Phone, Loader2 } from 'lucide-react'

// Lazy load heavy components
const CustomerForm = dynamic(() => import('./customer-form').then(mod => ({ default: mod.CustomerForm })), {
  loading: () => <div className="p-4">Cargando formulario...</div>,
})
const CustomerDetails = dynamic(() => import('./customer-details').then(mod => ({ default: mod.CustomerDetails })), {
  loading: () => <div className="p-4">Cargando detalles...</div>,
})

async function fetchCustomers(page: number, search: string) {
  const params = new URLSearchParams({
    page: page.toString(),
    limit: '50',
  })
  if (search) params.append('search', search)

  const res = await fetch(`/api/customers?${params}`)
  if (!res.ok) throw new Error('Failed to fetch customers')
  return res.json()
}

export function CustomerList() {
  const { toast } = useToast()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null)
  const [viewCustomer, setViewCustomer] = useState<any>(null)
  const queryClient = useQueryClient()

  // Debounce search to avoid excessive queries
  const debouncedSearch = useDebounce(search, 500)

  const { data, isLoading } = useQuery({
    queryKey: ['customers', page, debouncedSearch],
    queryFn: () => fetchCustomers(page, debouncedSearch),
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 5 * 60 * 1000,
    placeholderData: (prev) => prev,
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/customers/${id}`, {
        method: 'DELETE',
      })
      if (!res.ok) throw new Error('Failed to delete customer')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] })
    },
  })

  const handleEdit = useCallback((customer: any) => {
    setSelectedCustomer(customer)
    setIsFormOpen(true)
  }, [])

  const handleDelete = useCallback(async (customer: any) => {
    if (confirm(`¿Estás seguro de desactivar a ${customer.name}?`)) {
      await deleteMutation.mutateAsync(customer.id)
    }
  }, [deleteMutation])

  const handleView = useCallback(async (customer: any) => {
    if (!customer || !customer.id) {
      toast('Error: Cliente inválido', 'error')
      return
    }

    try {
      const url = `/api/customers/${customer.id}`

      const res = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      })

      if (!res.ok) {
        let errorMessage = 'Error al cargar los detalles del cliente'
        try {
          const error = await res.json()
          errorMessage = error.error || errorMessage
        } catch (e) {
          errorMessage = `Error ${res.status}: ${res.statusText}`
        }
        toast(errorMessage, 'error')
        return
      }

      const data = await res.json().catch(() => null)

      // Verificar que la estructura sea correcta
      if (!data || !data.customer) {
        toast('Error: Los datos del cliente no tienen la estructura esperada', 'error')
        return
      }

      setViewCustomer(data)
    } catch (error: any) {
      console.error('Error loading customer details:', error)
      console.error('Error name:', error.name)
      console.error('Error message:', error.message)
      console.error('Error stack:', error.stack)

      let errorMessage = 'Error de conexión al cargar los detalles del cliente'
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        errorMessage = 'Error de conexión: No se pudo conectar al servidor. Verifica que el servidor esté corriendo.'
      } else if (error.message) {
        errorMessage = error.message
      }

      toast(errorMessage, 'error')
    }
  }, [])

  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value)
    setPage(1)
  }, [])

  const { customers, pagination } = useMemo(() => {
    return data || { customers: [], pagination: { totalPages: 1 } }
  }, [data])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar clientes por nombre, NIT, email..."
            value={search}
            onChange={handleSearchChange}
            className="pl-9 rounded-full text-sm"
          />
        </div>
        <Button
          onClick={() => {
            setSelectedCustomer(null)
            setIsFormOpen(true)
          }}
        >
          <Plus className="h-4 w-4 mr-2" />
          Nuevo Cliente
        </Button>
      </div>

      {isLoading && customers.length === 0 ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground mr-2" />
          <span className="text-muted-foreground">Cargando clientes...</span>
        </div>
      ) : (
        <div className="border rounded-2xl bg-card/80 backdrop-blur-sm shadow-sm">
          <Table>
            <TableHeader className="bg-gray-50 dark:bg-gray-800/50">
              <TableRow>
                <TableHead className="py-3 px-4 font-semibold text-sm">Nombre</TableHead>
                <TableHead className="py-3 px-4 font-semibold text-sm">Contacto</TableHead>
                <TableHead className="py-3 px-4 font-semibold text-sm">Email</TableHead>
                <TableHead className="py-3 px-4 font-semibold text-sm">Teléfono</TableHead>
                <TableHead className="py-3 px-4 font-semibold text-sm">Tags</TableHead>
                <TableHead className="py-3 px-4 font-semibold text-sm">Estado</TableHead>
                <TableHead className="py-3 px-4 font-semibold text-sm">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {customers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-gray-500">
                    No hay clientes
                  </TableCell>
                </TableRow>
              ) : (
                customers.map((customer: any) => (
                  <TableRow key={customer.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 border-b">
                    <TableCell className="font-medium">{customer.name}</TableCell>
                    <TableCell>
                      {customer.taxId && (
                        <div className="text-sm text-gray-600">NIT: {customer.taxId}</div>
                      )}
                    </TableCell>
                    <TableCell>
                      {customer.email ? (
                        <div className="flex items-center gap-1 text-sm">
                          <Mail className="h-3 w-3" />
                          {customer.email}
                        </div>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {customer.phone ? (
                        <div className="flex items-center gap-1 text-sm">
                          <Phone className="h-3 w-3" />
                          {customer.phone}
                        </div>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {customer.tags ? (
                        <div className="flex gap-1 flex-wrap">
                          {customer.tags.split(',').filter(Boolean).map((tag: string, i: number) => (
                            <span key={i} className="px-2 py-0.5 text-xs bg-blue-100 text-blue-800 rounded">
                              {tag.trim()}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {customer.active ? (
                        <span className="px-2 py-1 text-xs bg-green-100 text-green-800 rounded">Activo</span>
                      ) : (
                        <span className="px-2 py-1 text-xs bg-gray-100 text-gray-800 rounded">Inactivo</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1 sm:gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleView(customer)}
                          title="Ver detalles"
                          className="h-8 w-8 p-0"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(customer)}
                          title="Editar"
                          className="h-8 w-8 p-0"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(customer)}
                          title="Desactivar"
                          className="h-8 w-8 p-0"
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
      )}

      {pagination.totalPages > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-sm text-gray-600 text-center sm:text-left">
            Página {pagination.page} de {pagination.totalPages} ({pagination.total} clientes)
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

      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedCustomer ? 'Editar Cliente' : 'Nuevo Cliente'}
            </DialogTitle>
          </DialogHeader>
          <CustomerForm
            customer={selectedCustomer}
            onSuccess={() => {
              setIsFormOpen(false)
              setSelectedCustomer(null)
            }}
          />
        </DialogContent>
      </Dialog>

      {viewCustomer && (
        <Dialog open={!!viewCustomer} onOpenChange={() => setViewCustomer(null)}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Detalles del Cliente</DialogTitle>
            </DialogHeader>
            <CustomerDetails customerData={viewCustomer} />
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}

