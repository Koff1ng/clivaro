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
import { Search, Plus, Edit, Trash2, Eye, FileText, Send } from 'lucide-react'

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

  // Debounce search to avoid excessive queries
  const debouncedSearch = useDebounce(search, 500)
  
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
      case 'DRAFT': return 'bg-gray-100 text-gray-800'
      case 'SENT': return 'bg-blue-100 text-blue-800'
      case 'ACCEPTED': return 'bg-green-100 text-green-800'
      case 'EXPIRED': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
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

  return (
    <>
      {sendingQuotationId && <LoadingOverlay message="Enviando cotización..." />}
      <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Buscar cotizaciones..."
            value={search}
            onChange={handleSearchChange}
            className="pl-10"
          />
        </div>
        <div className="flex gap-2">
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value)
              setPage(1)
            }}
            className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="">Todos los estados</option>
            <option value="DRAFT">Borrador</option>
            <option value="SENT">Enviada</option>
            <option value="ACCEPTED">Aceptada</option>
            <option value="EXPIRED">Expirada</option>
          </select>
          <div className="relative">
            <Input
              type="text"
              placeholder="Buscar cliente..."
              value={customerSearch}
              onChange={(e) => setCustomerSearch(e.target.value)}
              className="w-48"
            />
            <select
              value={customerFilter}
              onChange={(e) => {
                setCustomerFilter(e.target.value)
                setPage(1)
              }}
              className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm mt-2"
            >
              <option value="">Todos los clientes</option>
              {customers.slice(0, 50).map((customer: any) => (
                <option key={customer.id} value={customer.id}>{customer.name}</option>
              ))}
            </select>
          </div>
        </div>
        <Button onClick={() => {
          setSelectedQuotation(null)
          setIsFormOpen(true)
        }}>
          <Plus className="h-4 w-4 mr-2" />
          Nueva Cotización
        </Button>
      </div>

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
                <TableCell colSpan={7} className="text-center text-gray-500">
                  No hay cotizaciones
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

      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-600">
            Página {pagination.page} de {pagination.totalPages} ({pagination.total} cotizaciones)
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

