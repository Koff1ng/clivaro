'use client'

import React, { useState, useMemo, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import dynamic from 'next/dynamic'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useDebounce } from '@/lib/hooks/use-debounce'
import { formatCurrency, formatDate } from '@/lib/utils'
import { Search, Eye, FileText, QrCode, CheckCircle, XCircle, Clock, Trash2, Loader2, ShieldCheck, Send, Copy, Receipt } from 'lucide-react'
import { useToast } from '@/components/ui/toast'
import { Badge } from '@/components/ui/badge'
import { EmptyTableState } from '@/components/ui/empty-table-state'

// Lazy load heavy component
const InvoiceDetails = dynamic(() => import('./invoice-details').then(mod => ({ default: mod.InvoiceDetails })), {
  loading: () => <div className="p-4">Cargando detalles...</div>,
})

async function fetchInvoices(page: number, search: string, status: string, customerId: string, electronicStatus: string) {
  const params = new URLSearchParams({
    page: page.toString(),
    limit: '50',
  })
  if (search) params.append('search', search)
  if (status) params.append('status', status)
  if (customerId) params.append('customerId', customerId)
  if (electronicStatus) params.append('electronicStatus', electronicStatus)

  const res = await fetch(`/api/invoices?${params}`)
  if (!res.ok) throw new Error('Failed to fetch invoices')
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

export function InvoiceList() {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [electronicStatusFilter, setElectronicStatusFilter] = useState('')
  const [customerFilter, setCustomerFilter] = useState('')
  const [viewInvoice, setViewInvoice] = useState<any>(null)
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set())
  const router = useRouter()
  const queryClient = useQueryClient()
  const { toast } = useToast()

  // Debounce search to avoid excessive queries
  const debouncedSearch = useDebounce(search, 500)

  const [customerSearch, setCustomerSearch] = useState('')
  const debouncedCustomerSearch = useDebounce(customerSearch, 300)

  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value)
    setPage(1)
  }, [])

  const { data: customers = [] } = useQuery({
    queryKey: ['invoice-customers', debouncedCustomerSearch],
    queryFn: () => fetchCustomers(debouncedCustomerSearch || undefined),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000,
  })

  const { data: settingsData } = useQuery({
    queryKey: ['settings'],
    queryFn: async () => {
      const res = await fetch('/api/settings')
      if (!res.ok) throw new Error('Failed to fetch settings')
      return res.json()
    },
    staleTime: 5 * 60 * 1000 // 5 min
  })

  const { data, isLoading } = useQuery({
    queryKey: ['invoices', page, debouncedSearch, statusFilter, customerFilter, electronicStatusFilter],
    queryFn: () => fetchInvoices(page, debouncedSearch, statusFilter, customerFilter, electronicStatusFilter),
    staleTime: 30 * 1000, // 30s for real-time feel
    gcTime: 5 * 60 * 1000,
    placeholderData: (prev) => prev,
    refetchInterval: electronicStatusFilter ? 10000 : undefined, // Auto-refresh when filtering electronic
  })

  const sendElectronicMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/invoices/${id}/send-electronic`, {
        method: 'POST',
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to send invoice')
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] })
    },
  })

  const deleteInvoiceMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/invoices/${id}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to delete invoice')
      }
      return res.json()
    },
    onSuccess: (_, invoiceId) => {
      // Agregar animación de eliminación
      setDeletingIds(prev => new Set(prev).add(invoiceId))

      // Esperar a que termine la animación antes de invalidar queries
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['invoices'] })
        setDeletingIds(prev => {
          const next = new Set(prev)
          next.delete(invoiceId)
          return next
        })
        toast('Factura eliminada exitosamente', 'success')
      }, 500)
    },
    onError: (error: any) => {
      toast(error.message || 'Error al eliminar factura', 'error')
    },
  })

  const handleDelete = async (invoice: any) => {
    if (confirm(`¿Está seguro de eliminar la factura ${invoice.number}? Esta acción no se puede deshacer.`)) {
      try {
        await deleteInvoiceMutation.mutateAsync(invoice.id)
      } catch (error: any) {
        // Error ya manejado en onError
      }
    }
  }

  const handleView = async (invoice: any) => {
    try {
      if (!invoice || !invoice.id) {
        toast('Factura inválida', 'error')
        return
      }

      const url = `/api/invoices/${invoice.id}`

      const res = await fetch(url, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      })

      let data: any = null
      try {
        data = await res.json()
      } catch {
        // keep null
      }

      if (!res.ok) {
        // Mensajes de error más descriptivos según el código de estado
        let errorMessage = data?.error || data?.message || `Error ${res.status}: ${res.statusText}`

        if (res.status === 401) {
          errorMessage = 'No autorizado. Por favor, inicia sesión nuevamente.'
        } else if (res.status === 403) {
          errorMessage = 'No tienes permisos para ver esta factura.'
        } else if (res.status === 404) {
          errorMessage = 'Factura no encontrada.'
        } else if (res.status === 500) {
          errorMessage = `Error del servidor: ${data?.message || data?.error || 'Error desconocido'}`
        }

        throw new Error(errorMessage)
      }

      if (!data || !data.id) {
        throw new Error('No se recibieron los datos de la factura correctamente')
      }

      // Validar que los items estén presentes
      if (!Array.isArray(data.items)) {
        data.items = []
      }

      setViewInvoice(data)
    } catch (error: any) {
      const errorMessage = error?.message || 'Error desconocido al cargar los detalles de la factura'
      toast(errorMessage, 'error')
    }
  }

  const handleSendElectronic = async (invoice: any) => {
    if (!settingsData?.settings?.electronicBillingProvider) {
      toast('Configura las credenciales de Factus en Ajustes > Facturación Electrónica', 'error')
      router.push('/settings?tab=billing')
      return
    }
    if (confirm(`¿Enviar la factura ${invoice.number} a la DIAN vía Factus?`)) {
      try {
        const result = await sendElectronicMutation.mutateAsync(invoice.id)
        toast(`✅ Factura ${invoice.number} enviada. CUFE: ${result.cufe?.substring(0, 20)}...`, 'success')
        queryClient.invalidateQueries({ queryKey: ['invoices'] })
      } catch (error: any) {
        toast(error.message || 'Error al enviar factura electrónica', 'error')
      }
    }
  }

  const copyCufe = (cufe: string) => {
    navigator.clipboard.writeText(cufe)
    toast('CUFE copiado al portapapeles', 'success')
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'EMITIDA':
      case 'ISSUED': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
      case 'PAGADA':
      case 'PAID': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
      case 'ANULADA':
      case 'VOID': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
      case 'EN_COBRANZA':
      case 'PARCIAL':
      case 'PARTIAL': return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200'
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200'
    }
  }

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      EMITIDA: 'Emitida',
      PAGADA: 'Pagada',
      ANULADA: 'Anulada',
      EN_COBRANZA: 'En Cobranza',
      // Compatibilidad con estados antiguos
      ISSUED: 'Emitida',
      PAID: 'Pagada',
      VOID: 'Anulada',
      PARCIAL: 'En Cobranza',
      PARTIAL: 'En Cobranza',
    }
    return labels[status] || status
  }

  const getElectronicBadge = (status: string | null, cufe?: string) => {
    switch (status) {
      case 'ACCEPTED':
        return (
          <Badge className="bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800 text-[10px]">
            <ShieldCheck className="h-3 w-3 mr-1" /> Aceptada DIAN
          </Badge>
        )
      case 'SENT':
        return (
          <Badge className="bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800 text-[10px]">
            <Send className="h-3 w-3 mr-1" /> Enviada
          </Badge>
        )
      case 'REJECTED':
        return (
          <Badge className="bg-red-50 text-red-700 hover:bg-red-100 border border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800 text-[10px]">
            <XCircle className="h-3 w-3 mr-1" /> Rechazada
          </Badge>
        )
      case 'PENDING':
        return (
          <Badge className="bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800 text-[10px]">
            <Clock className="h-3 w-3 mr-1" /> Pendiente
          </Badge>
        )
      default:
        return (
          <Badge variant="outline" className="text-gray-400 border-gray-200 text-[10px]">
            <Clock className="h-3 w-3 mr-1" /> Sin enviar
          </Badge>
        )
    }
  }

  const { invoices, pagination } = useMemo(() => {
    return data || { invoices: [], pagination: { totalPages: 1 } }
  }, [data])

  const searchParams = useSearchParams()

  // Si se intenta crear factura directamente, redirigir al POS o mostrar mensaje
  // En este ERP las facturas se crean desde el POS o desde una Orden
  React.useEffect(() => {
    if (searchParams.get('new') === 'invoice') {
      router.push('/pos')
      toast('Redirigiendo al Punto de Venta para crear nueva factura', 'info')
    }
  }, [searchParams, router, toast])

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar facturas (número, CUFE, cliente)..."
            value={search}
            onChange={handleSearchChange}
            className="pl-9 rounded-full text-sm"
          />
        </div>
        <div className="flex gap-2 flex-wrap sm:flex-nowrap">
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value)
              setPage(1)
            }}
            className="flex h-9 rounded-full border border-input bg-background px-3 py-1.5 text-xs md:text-sm"
          >
            <option value="">Todos los estados</option>
            <option value="EMITIDA">Emitida</option>
            <option value="PAGADA">Pagada</option>
            <option value="EN_COBRANZA">En Cobranza</option>
            <option value="ANULADA">Anulada</option>
          </select>
          <select
            value={electronicStatusFilter}
            onChange={(e) => {
              setElectronicStatusFilter(e.target.value)
              setPage(1)
            }}
            className="flex h-9 rounded-full border border-input bg-background px-3 py-1.5 text-xs md:text-sm"
          >
            <option value="">DIAN: Todos</option>
            <option value="SENT">✅ Enviadas/Aceptadas</option>
            <option value="PENDING">⏳ Pendientes</option>
            <option value="REJECTED">❌ Rechazadas</option>
          </select>
          <div className="flex flex-col gap-1 w-full sm:w-auto">
            <Input
              type="text"
              placeholder="Buscar cliente..."
              value={customerSearch}
              onChange={(e) => setCustomerSearch(e.target.value)}
              className="w-full sm:w-48 h-9 text-xs sm:text-sm"
            />
            <select
              value={customerFilter}
              onChange={(e) => {
                setCustomerFilter(e.target.value)
                setPage(1)
              }}
              className="flex h-9 rounded-full border border-input bg-background px-3 py-1.5 text-xs sm:text-sm w-full sm:w-auto"
            >
              <option value="">Todos los clientes</option>
              {customers.slice(0, 50).map((customer: any) => (
                <option key={customer.id} value={customer.id}>{customer.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {isLoading && invoices.length === 0 ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground mr-2" />
          <span className="text-muted-foreground">Cargando facturas...</span>
        </div>
      ) : invoices.length === 0 ? (
        <div className="border rounded-2xl bg-card/80 backdrop-blur-sm shadow-sm overflow-hidden">
          <EmptyTableState
            icon={Receipt}
            title="Crea tu primera factura"
            description="Las facturas se generan automáticamente al completar una venta en el Punto de Venta. También puedes crear facturas electrónicas válidas ante la DIAN."
            actionLabel="Ir al Punto de Venta"
            onAction="/pos"
          />
        </div>
      ) : (
        <div className="border rounded-2xl bg-card/80 backdrop-blur-sm shadow-sm">
          <Table>
            <TableHeader className="bg-gray-50 dark:bg-gray-800/50">
              <TableRow>
                <TableHead className="py-3 px-4 font-semibold text-sm">Número</TableHead>
                <TableHead className="py-3 px-4 font-semibold text-sm">Cliente</TableHead>
                <TableHead className="py-3 px-4 font-semibold text-sm">Fecha</TableHead>
                <TableHead className="py-3 px-4 font-semibold text-sm">Estado</TableHead>
                <TableHead className="py-3 px-4 font-semibold text-sm">Fact. Electrónica</TableHead>
                <TableHead className="py-3 px-4 font-semibold text-sm text-right">Total</TableHead>
                <TableHead className="py-3 px-4 font-semibold text-sm text-right">Saldo</TableHead>
                <TableHead className="py-3 px-4 font-semibold text-sm">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices.map((invoice: any) => {
                const isDeleting = deletingIds.has(invoice.id)
                return (
                  <TableRow
                    key={invoice.id}
                    className={`${isDeleting ? 'animate-slide-up-out' : ''} hover:bg-gray-50 dark:hover:bg-gray-800/50 border-b transition-colors`}
                  >
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        {invoice.number}
                        {invoice.cufe && (
                          <span title="Factura electrónica">
                            <FileText className="h-4 w-4 text-green-600" />
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{invoice.customer?.name || '-'}</TableCell>
                    <TableCell>{formatDate(invoice.createdAt)}</TableCell>
                    <TableCell>
                      <span className={`px-2 py-1 text-xs rounded ${getStatusColor(invoice.status)}`}>
                        {getStatusLabel(invoice.status)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        {getElectronicBadge(invoice.electronicStatus, invoice.cufe)}
                        {invoice.cufe && (
                          <div className="flex items-center gap-1">
                            <code className="text-[9px] font-mono text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded max-w-[100px] truncate">
                              {invoice.cufe}
                            </code>
                            <button
                              onClick={(e) => { e.stopPropagation(); copyCufe(invoice.cufe) }}
                              className="p-0.5 rounded hover:bg-muted transition-colors"
                              title="Copiar CUFE"
                            >
                              <Copy className="h-2.5 w-2.5 text-muted-foreground" />
                            </button>
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">{formatCurrency(invoice.total)}</TableCell>
                    <TableCell className="text-right">
                      {(() => {
                        const totalPaid = (invoice.payments || []).reduce((sum: number, p: any) => sum + (p.amount || 0), 0)
                        const balance = Math.max(0, invoice.total - totalPaid)
                        return (
                          <span className={balance > 0 ? 'text-orange-600 font-medium' : 'text-gray-400'}>
                            {formatCurrency(balance)}
                          </span>
                        )
                      })()}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleView(invoice)}
                          title="Ver detalles"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        {(!invoice.electronicStatus || invoice.electronicStatus === 'PENDING' || invoice.electronicStatus === 'REJECTED') && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleSendElectronic(invoice)}
                            title={invoice.electronicStatus === 'REJECTED' ? 'Reintentar envío DIAN' : 'Enviar a DIAN vía Factus'}
                            disabled={sendElectronicMutation.isPending}
                            className={invoice.electronicStatus === 'REJECTED' ? 'text-red-600 hover:text-red-700 hover:bg-red-50' : ''}
                          >
                            {sendElectronicMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(invoice)}
                          title="Eliminar factura"
                          disabled={deleteInvoiceMutation.isPending}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-600">
            Página {pagination.page} de {pagination.totalPages} ({pagination.total} facturas)
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

      {viewInvoice && (
        <Dialog open={!!viewInvoice} onOpenChange={() => setViewInvoice(null)}>
          <DialogContent className="w-auto sm:max-w-fit max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Detalles de la Factura
              </DialogTitle>
            </DialogHeader>
            <InvoiceDetails invoice={viewInvoice} />
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}

