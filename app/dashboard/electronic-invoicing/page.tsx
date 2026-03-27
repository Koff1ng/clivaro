'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import {
  Receipt, Loader2, AlertCircle, CheckCircle2, Clock, Send,
  QrCode, FileText, RefreshCw, ExternalLink, Copy, Filter,
  Zap, ShieldCheck, XCircle, ArrowUpRight
} from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { MainLayout } from '@/components/layout/main-layout'
import { useToast } from '@/components/ui/toast'
import { formatCurrency } from '@/lib/utils'

type StatusFilter = 'ALL' | 'SENT' | 'PENDING' | 'REJECTED'

async function fetchElectronicInvoices(page: number, status: StatusFilter) {
  const params = new URLSearchParams({ page: page.toString(), limit: '50' })
  if (status !== 'ALL') params.append('status', status)
  const res = await fetch(`/api/electronic-invoicing/transmissions?${params}`)
  if (!res.ok) throw new Error('Failed to fetch')
  return res.json()
}

export default function ElectronicInvoicingMonitor() {
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL')
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const { data, isLoading, error, isFetching, dataUpdatedAt } = useQuery({
    queryKey: ['ei-monitor', page, statusFilter],
    queryFn: () => fetchElectronicInvoices(page, statusFilter),
    refetchInterval: 15000,
    placeholderData: (prev) => prev,
  })

  const sendElectronicMutation = useMutation({
    mutationFn: async (invoiceId: string) => {
      const res = await fetch(`/api/invoices/${invoiceId}/send-electronic`, { method: 'POST' })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Error al enviar')
      }
      return res.json()
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['ei-monitor'] })
      queryClient.invalidateQueries({ queryKey: ['invoices'] })
      toast(`Factura enviada. CUFE: ${result.cufe?.substring(0, 20)}...`, 'success')
    },
    onError: (err: any) => {
      toast(err.message || 'Error al enviar factura', 'error')
    },
  })

  const stats = data?.stats || { sent: 0, rejected: 0, pending: 0, totalInvoices: 0 }
  const invoices = data?.invoices || []
  const pagination = data?.pagination || { page: 1, totalPages: 1, total: 0 }

  const getStatusBadge = (status: string | null) => {
    switch (status) {
      case 'ACCEPTED':
        return (
          <Badge className="bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800">
            <ShieldCheck className="h-3 w-3 mr-1" /> Aceptada DIAN
          </Badge>
        )
      case 'SENT':
        return (
          <Badge className="bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800">
            <Send className="h-3 w-3 mr-1" /> Enviada
          </Badge>
        )
      case 'REJECTED':
        return (
          <Badge className="bg-red-50 text-red-700 hover:bg-red-100 border border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800">
            <XCircle className="h-3 w-3 mr-1" /> Rechazada
          </Badge>
        )
      case 'PENDING':
        return (
          <Badge className="bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800">
            <Clock className="h-3 w-3 mr-1" /> Pendiente
          </Badge>
        )
      default:
        return (
          <Badge variant="outline" className="text-gray-500 border-gray-300">
            <Clock className="h-3 w-3 mr-1" /> Sin enviar
          </Badge>
        )
    }
  }

  const copyCufe = (cufe: string) => {
    navigator.clipboard.writeText(cufe)
    toast('CUFE copiado al portapapeles', 'success')
  }

  const statusFilters: { value: StatusFilter; label: string; icon: any; count: number }[] = [
    { value: 'ALL', label: 'Todas', icon: FileText, count: stats.totalInvoices },
    { value: 'SENT', label: 'Enviadas', icon: ShieldCheck, count: stats.sent },
    { value: 'PENDING', label: 'Pendientes', icon: Clock, count: stats.pending },
    { value: 'REJECTED', label: 'Rechazadas', icon: XCircle, count: stats.rejected },
  ]

  return (
    <MainLayout>
      <div className="space-y-6">
        <PageHeader
          title="Facturación Electrónica"
          description="Monitor en tiempo real de facturas electrónicas vía Factus · DIAN"
          icon={<Zap className="h-6 w-6" />}
          actions={
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => queryClient.invalidateQueries({ queryKey: ['ei-monitor'] })}
                disabled={isFetching}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? 'animate-spin' : ''}`} />
                Actualizar
              </Button>
              <Button variant="outline" size="sm" asChild>
                <Link href="/dashboard">
                  Volver al panel
                </Link>
              </Button>
            </div>
          }
        />

        {/* Stats Cards */}
        <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
          <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 border-blue-100 dark:border-blue-900">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-blue-600 dark:text-blue-400 uppercase tracking-wider">Total Facturas</p>
                  <p className="text-3xl font-bold text-blue-900 dark:text-blue-100 mt-1">{stats.totalInvoices}</p>
                </div>
                <div className="h-12 w-12 rounded-xl bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center">
                  <FileText className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-emerald-50 to-green-50 dark:from-emerald-950/30 dark:to-green-950/30 border-emerald-100 dark:border-emerald-900">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Enviadas / Aceptadas</p>
                  <p className="text-3xl font-bold text-emerald-900 dark:text-emerald-100 mt-1">{stats.sent}</p>
                </div>
                <div className="h-12 w-12 rounded-xl bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center">
                  <ShieldCheck className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-amber-50 to-yellow-50 dark:from-amber-950/30 dark:to-yellow-950/30 border-amber-100 dark:border-amber-900">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-amber-600 dark:text-amber-400 uppercase tracking-wider">Pendientes</p>
                  <p className="text-3xl font-bold text-amber-900 dark:text-amber-100 mt-1">{stats.pending}</p>
                </div>
                <div className="h-12 w-12 rounded-xl bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center">
                  <Clock className="h-6 w-6 text-amber-600 dark:text-amber-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-red-50 to-rose-50 dark:from-red-950/30 dark:to-rose-950/30 border-red-100 dark:border-red-900">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-red-600 dark:text-red-400 uppercase tracking-wider">Rechazadas</p>
                  <p className="text-3xl font-bold text-red-900 dark:text-red-100 mt-1">{stats.rejected}</p>
                </div>
                <div className="h-12 w-12 rounded-xl bg-red-100 dark:bg-red-900/50 flex items-center justify-center">
                  <XCircle className="h-6 w-6 text-red-600 dark:text-red-400" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Live indicator + Filter tabs */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
              </span>
              Actualización automática
            </div>
            {dataUpdatedAt && (
              <span className="text-xs text-muted-foreground">
                Última: {format(new Date(dataUpdatedAt), 'HH:mm:ss')}
              </span>
            )}
          </div>

          <div className="flex gap-1 bg-muted/50 p-1 rounded-lg">
            {statusFilters.map((f) => {
              const Icon = f.icon
              return (
                <button
                  key={f.value}
                  onClick={() => { setStatusFilter(f.value); setPage(1) }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-all
                    ${statusFilter === f.value
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                    }`}
                >
                  <Icon className="h-3 w-3" />
                  {f.label}
                  <span className={`ml-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-semibold
                    ${statusFilter === f.value ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
                    {f.count}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Invoices Table */}
        <Card className="border rounded-2xl bg-card/80 backdrop-blur-sm shadow-sm">
          <CardContent className="p-0">
            {isLoading && invoices.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                <span className="text-muted-foreground text-sm">Cargando facturas electrónicas...</span>
              </div>
            ) : error ? (
              <div className="p-8 text-center">
                <AlertCircle className="h-8 w-8 text-destructive mx-auto mb-3" />
                <p className="text-destructive font-medium">Error al cargar los datos</p>
                <p className="text-sm text-muted-foreground mt-1">Intenta actualizar la página</p>
              </div>
            ) : (
              <Table>
                <TableHeader className="bg-gray-50/80 dark:bg-gray-800/50">
                  <TableRow>
                    <TableHead className="py-3 px-4 font-semibold text-sm">Factura</TableHead>
                    <TableHead className="py-3 px-4 font-semibold text-sm">Cliente</TableHead>
                    <TableHead className="py-3 px-4 font-semibold text-sm">Fecha</TableHead>
                    <TableHead className="py-3 px-4 font-semibold text-sm">Estado DIAN</TableHead>
                    <TableHead className="py-3 px-4 font-semibold text-sm">CUFE</TableHead>
                    <TableHead className="py-3 px-4 font-semibold text-sm text-right">Total</TableHead>
                    <TableHead className="py-3 px-4 font-semibold text-sm">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoices.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-16">
                        <div className="flex flex-col items-center gap-3">
                          <div className="h-14 w-14 rounded-2xl bg-muted/50 flex items-center justify-center">
                            <Receipt className="h-7 w-7 text-muted-foreground" />
                          </div>
                          <div>
                            <p className="font-medium text-muted-foreground">No hay facturas electrónicas</p>
                            <p className="text-xs text-muted-foreground mt-1">
                              Envía tu primera factura desde el módulo de Facturas
                            </p>
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    invoices.map((inv: any) => (
                      <TableRow key={inv.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/30 transition-colors">
                        <TableCell className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-indigo-100 to-blue-100 dark:from-indigo-900/40 dark:to-blue-900/40 flex items-center justify-center">
                              <FileText className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                            </div>
                            <span className="font-medium">{inv.number}</span>
                          </div>
                        </TableCell>
                        <TableCell className="py-3 px-4">
                          <div>
                            <p className="font-medium text-sm">{inv.customer?.name || 'Sin cliente'}</p>
                            {inv.customer?.taxId && (
                              <p className="text-xs text-muted-foreground">NIT: {inv.customer.taxId}</p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="py-3 px-4">
                          <div>
                            <p className="text-sm">{format(new Date(inv.issuedAt || inv.createdAt), 'dd MMM yyyy', { locale: es })}</p>
                            <p className="text-xs text-muted-foreground">{format(new Date(inv.issuedAt || inv.createdAt), 'HH:mm', { locale: es })}</p>
                          </div>
                        </TableCell>
                        <TableCell className="py-3 px-4">
                          <div className="space-y-1">
                            {getStatusBadge(inv.electronicStatus)}
                            {inv.electronicSentAt && (
                              <p className="text-[10px] text-muted-foreground">
                                Enviada: {format(new Date(inv.electronicSentAt), 'dd/MM HH:mm')}
                              </p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="py-3 px-4">
                          {inv.cufe ? (
                            <div className="flex items-center gap-1.5">
                              <code className="text-[10px] font-mono text-muted-foreground bg-muted/50 px-2 py-1 rounded max-w-[140px] truncate">
                                {inv.cufe}
                              </code>
                              <button
                                onClick={() => copyCufe(inv.cufe)}
                                className="p-1 rounded hover:bg-muted transition-colors"
                                title="Copiar CUFE"
                              >
                                <Copy className="h-3 w-3 text-muted-foreground" />
                              </button>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="py-3 px-4 text-right font-medium">
                          {formatCurrency(inv.total)}
                        </TableCell>
                        <TableCell className="py-3 px-4">
                          <div className="flex gap-1">
                            {(!inv.electronicStatus || inv.electronicStatus === 'PENDING' || inv.electronicStatus === 'REJECTED') && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  if (confirm(`¿Enviar factura ${inv.number} a la DIAN vía Factus?`)) {
                                    sendElectronicMutation.mutate(inv.id)
                                  }
                                }}
                                disabled={sendElectronicMutation.isPending}
                                title="Enviar a DIAN"
                                className="h-8 w-8 p-0"
                              >
                                <Send className="h-4 w-4" />
                              </Button>
                            )}
                            {inv.qrCode && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => window.open(inv.qrCode, '_blank')}
                                title="Ver QR DIAN"
                                className="h-8 w-8 p-0"
                              >
                                <QrCode className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Página {pagination.page} de {pagination.totalPages} ({pagination.total} facturas)
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                Anterior
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))}
                disabled={page === pagination.totalPages}
              >
                Siguiente
              </Button>
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  )
}
