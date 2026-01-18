'use client'

import React, { useState, useMemo, useCallback, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSearchParams } from 'next/navigation'
import dynamic from 'next/dynamic'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useDebounce } from '@/lib/hooks/use-debounce'
import { formatCurrency, formatDate } from '@/lib/utils'
import { useToast } from '@/components/ui/toast'
import { LoadingOverlay } from '@/components/ui/loading-overlay'
import { Search, Plus, Edit, Trash2, Eye, FileText, Send, X, Loader2, Filter } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

// Lazy load heavy components
const QuotationForm = dynamic(() => import('./quotation-form').then(mod => ({ default: mod.QuotationForm })), {
  loading: () => <div className="p-4">Cargando formulario...</div>,
})
const QuotationDetails = dynamic(() => import('./quotation-details').then(mod => ({ default: mod.QuotationDetails })), {
  loading: () => <div className="p-4">Cargando detalles...</div>,
})

async function fetchQuotations(page: number, search: string, status: string, customerId: string) {
  const params = new URLSearchParams({
    page: page.toString(),
    limit: '50',
  })
  if (search) params.append('search', search)
  if (status) params.append('status', status)
  if (customerId) params.append('customerId', customerId)
  
  const res = await fetch(`/api/quotations?${params}`)
  if (!res.ok) throw new Error('Failed to fetch quotations')
  return res.json()
}

async function fetchCustomers(search?: string) {
  const params = new URLSearchParams({ limit: '100' }) // Reducido de 1000 a 100
  if (search) params.append('search', search)
  const res = await fetch(`/api/customers?${params}`)
  if (!res.ok) return []
  const data = await res.json()
  return data.customers || []
}

export function QuotationList() {
  const { toast } = useToast()
  const searchParams = useSearchParams()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [customerFilter, setCustomerFilter] = useState('')
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [selectedQuotation, setSelectedQuotation] = useState<any>(null)
  const [viewQuotation, setViewQuotation] = useState<any>(null)
  const [sendingQuotationId, setSendingQuotationId] = useState<string | null>(null)
  const queryClient = useQueryClient()

  // Abrir formulario si viene con parámetros de nueva cotización desde oportunidad
  useEffect(() => {
    const leadId = searchParams.get('leadId')
    const isNew = searchParams.get('new')
    if (leadId && isNew === 'true' && !isFormOpen) {
      setIsFormOpen(true)
      // Limpiar la URL
      window.history.replaceState({}, '', '/sales/quotes')
    }
  }, [searchParams, isFormOpen])

  // Debounce search to avoid excessive queries - reduced for more immediate feedback
  const debouncedSearch = useDebounce(search, 300)
  
  const [customerSearch, setCustomerSearch] = useState('')
  const debouncedCustomerSearch = useDebounce(customerSearch, 300)

  const { data: customers = [] } = useQuery({
    queryKey: ['quotation-customers', debouncedCustomerSearch],
    queryFn: () => fetchCustomers(debouncedCustomerSearch || undefined),
    staleTime: 5 * 60 * 1000, // 5 minutes - customers don't change frequently
    gcTime: 10 * 60 * 1000,
  })

  const { data, isLoading } = useQuery({
    queryKey: ['quotations', page, debouncedSearch, statusFilter, customerFilter],
    queryFn: () => fetchQuotations(page, debouncedSearch, statusFilter, customerFilter),
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 5 * 60 * 1000,
    placeholderData: (prev) => prev,
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/quotations/${id}`, {
        method: 'DELETE',
      })
      if (!res.ok) throw new Error('Failed to delete quotation')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotations'] })
    },
  })

  const sendMutation = useMutation({
    mutationFn: async (id: string) => {
      setSendingQuotationId(id)
      const res = await fetch(`/api/quotations/${id}/send`, {
        method: 'POST',
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.message || data.error || 'Error al enviar cotización')
      }
      return data
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['quotations'] })
      queryClient.invalidateQueries({ queryKey: ['activity-feed'] })
      setSendingQuotationId(null)
      if (data.emailSent) {
        toast(data.message || `Cotización enviada exitosamente a ${data.email}`, 'success')
      } else {
        const errorDetails = data.emailError === 'SMTP not configured'
          ? 'El servicio de email no está configurado. Configure las variables SMTP en .env'
          : data.emailMessage || data.emailError || 'Error desconocido'
        toast(`Error al enviar el email: ${errorDetails} - Email destino: ${data.email}`, 'error')
      }
    },
    onError: (error: any) => {
      setSendingQuotationId(null)
      const errorMessage = error.message || 'No se pudo enviar la cotización'
      toast(`Error: ${errorMessage}`, 'error')
    },
  })

  const handleEdit = useCallback((quotation: any) => {
    setSelectedQuotation(quotation)
    setIsFormOpen(true)
  }, [])

  const handleDelete = useCallback(async (quotation: any) => {
    if (confirm(`¿Estás seguro de eliminar la cotización "${quotation.number}"?`)) {
      await deleteMutation.mutateAsync(quotation.id)
    }
  }, [deleteMutation])

  const handleView = useCallback(async (quotation: any) => {
    try {
      const res = await fetch(`/api/quotations/${quotation.id}`)
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Error al cargar la cotización')
      }
      const data = await res.json()
      setViewQuotation(data)
    } catch (error: any) {
      toast(error.message || 'Error al cargar los detalles de la cotización', 'error')
    }
  }, [toast])

  const handleSend = useCallback(async (quotation: any) => {
    if (!quotation.customer?.email) {
      toast('El cliente no tiene un email registrado. Por favor, actualice los datos del cliente antes de enviar la cotización.', 'warning')
      return
    }
    
    try {
      await sendMutation.mutateAsync(quotation.id)
    } catch (error: any) {
      // Error already handled in mutation onError
    }
  }, [sendMutation])

  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value)
    setPage(1)
  }, [])

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'DRAFT': return 'bg-muted text-muted-foreground'
      case 'SENT': return 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
      case 'ACCEPTED': return 'bg-green-500/10 text-green-600 dark:text-green-400'
      case 'EXPIRED': return 'bg-red-500/10 text-red-600 dark:text-red-400'
      default: return 'bg-muted text-muted-foreground'
    }
  }

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      DRAFT: 'Borrador',
      SENT: 'Enviada',
      ACCEPTED: 'Aceptada',
      EXPIRED: 'Expirada',
    }
    return labels[status] || status
  }

  const { quotations, pagination } = useMemo(() => {
    return data || { quotations: [], pagination: { totalPages: 1 } }
  }, [data])

  const selectedCustomer = useMemo(() => {
    return customers.find((c: any) => c.id === customerFilter)
  }, [customers, customerFilter])

  const hasActiveFilters = search || statusFilter || customerFilter

  const clearFilters = useCallback(() => {
    setSearch('')
    setStatusFilter('')
    setCustomerFilter('')
    setCustomerSearch('')
    setPage(1)
  }, [])

  return (
    <>
      {sendingQuotationId && <LoadingOverlay message="Enviando cotización..." />}
      <div className="space-y-4">
      {/* Search and Filters Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 bg-card rounded-lg border">
        <div className="relative flex-1 w-full sm:max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por número, cliente..."
            value={search}
            onChange={handleSearchChange}
            className="pl-10 pr-10"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          {/* Status Filter */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="gap-2">
                <Filter className="h-4 w-4" />
                {statusFilter ? getStatusLabel(statusFilter) : 'Estado'}
                {statusFilter && (
                  <X 
                    className="h-3 w-3 ml-1" 
                    onClick={(e) => {
                      e.stopPropagation()
                      setStatusFilter('')
                      setPage(1)
                    }}
                  />
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Filtrar por Estado</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => { setStatusFilter(''); setPage(1) }}>
                Todos los estados
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => { setStatusFilter('DRAFT'); setPage(1) }}>
                Borrador
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => { setStatusFilter('SENT'); setPage(1) }}>
                Enviada
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => { setStatusFilter('ACCEPTED'); setPage(1) }}>
                Aceptada
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => { setStatusFilter('EXPIRED'); setPage(1) }}>
                Expirada
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Customer Filter */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="gap-2 min-w-[180px] justify-between">
                <span className="truncate">
                  {selectedCustomer ? selectedCustomer.name : 'Cliente'}
                </span>
                {customerFilter && (
                  <X 
                    className="h-3 w-3 ml-1 flex-shrink-0" 
                    onClick={(e) => {
                      e.stopPropagation()
                      setCustomerFilter('')
                      setCustomerSearch('')
                      setPage(1)
                    }}
                  />
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuLabel>Filtrar por Cliente</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <div className="p-2">
                <Input
                  placeholder="Buscar cliente..."
                  value={customerSearch}
                  onChange={(e) => setCustomerSearch(e.target.value)}
                  className="w-full"
                />
              </div>
              <div className="max-h-60 overflow-y-auto">
                <DropdownMenuItem onClick={() => { setCustomerFilter(''); setCustomerSearch(''); setPage(1) }}>
                  Todos los clientes
                </DropdownMenuItem>
                {customers.slice(0, 50).map((customer: any) => (
                  <DropdownMenuItem
                    key={customer.id}
                    onClick={() => {
                      setCustomerFilter(customer.id)
                      setCustomerSearch('')
                      setPage(1)
                    }}
                    className={customerFilter === customer.id ? 'bg-accent' : ''}
                  >
                    {customer.name}
                  </DropdownMenuItem>
                ))}
                {customers.length === 0 && debouncedCustomerSearch && (
                  <div className="px-2 py-4 text-sm text-muted-foreground text-center">
                    No se encontraron clientes
                  </div>
                )}
              </div>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Clear Filters */}
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-2">
              <X className="h-4 w-4" />
              Limpiar
            </Button>
          )}

          <Button onClick={() => {
            setSelectedQuotation(null)
            setIsFormOpen(true)
          }} className="gap-2">
            <Plus className="h-4 w-4" />
            Nueva Cotización
          </Button>
        </div>
      </div>

      {/* Results */}
      {isLoading && quotations.length === 0 ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground mr-2" />
          <span className="text-muted-foreground">Cargando cotizaciones...</span>
        </div>
      ) : (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Número</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead>Válida Hasta</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {quotations.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-12">
                    <div className="flex flex-col items-center gap-2">
                      <FileText className="h-12 w-12 text-muted-foreground/50" />
                      <p className="text-muted-foreground font-medium">
                        {hasActiveFilters 
                          ? 'No se encontraron cotizaciones con los filtros aplicados' 
                          : 'No hay cotizaciones'}
                      </p>
                      {hasActiveFilters && (
                        <Button variant="outline" size="sm" onClick={clearFilters} className="mt-2">
                          Limpiar filtros
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
              quotations.map((quotation: any) => (
                <TableRow key={quotation.id}>
                  <TableCell className="font-medium">{quotation.number}</TableCell>
                  <TableCell>{quotation.customer?.name || '-'}</TableCell>
                  <TableCell>{formatDate(quotation.createdAt)}</TableCell>
                  <TableCell>
                    {quotation.validUntil ? formatDate(quotation.validUntil) : '-'}
                  </TableCell>
                  <TableCell>
                    <span className={`px-2 py-1 text-xs rounded ${getStatusColor(quotation.status)}`}>
                      {getStatusLabel(quotation.status)}
                    </span>
                  </TableCell>
                  <TableCell>{formatCurrency(quotation.total)}</TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleView(quotation)}
                        title="Ver detalles"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      {quotation.status === 'DRAFT' && (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(quotation)}
                            title="Editar"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleSend(quotation)}
                            title="Enviar"
                          >
                            <Send className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                      {(quotation.status === 'SENT' || quotation.status === 'ACCEPTED') && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleSend(quotation)}
                          title="Reenviar por email"
                        >
                          <Send className="h-4 w-4" />
                        </Button>
                      )}
                      {quotation.status === 'DRAFT' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(quotation)}
                          title="Eliminar"
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      )}
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
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 bg-card rounded-lg border">
          <div className="text-sm text-muted-foreground">
            Mostrando página {pagination.page} de {pagination.totalPages} ({pagination.total} cotizaciones)
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
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedQuotation ? 'Editar Cotización' : 'Nueva Cotización'}
            </DialogTitle>
          </DialogHeader>
          <QuotationForm
            quotation={selectedQuotation}
            customers={customers}
            onSuccess={() => {
              setIsFormOpen(false)
              setSelectedQuotation(null)
            }}
          />
        </DialogContent>
      </Dialog>

      {viewQuotation && (
        <Dialog open={!!viewQuotation} onOpenChange={() => setViewQuotation(null)}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Detalles de la Cotización</DialogTitle>
            </DialogHeader>
            <QuotationDetails quotation={viewQuotation} />
          </DialogContent>
        </Dialog>
      )}
    </div>
    </>
  )
}

