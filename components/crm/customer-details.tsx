'use client'

import { formatCurrency, formatDate } from '@/lib/utils'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Mail, Phone, MapPin, FileText, ShoppingCart, Receipt, Tag } from 'lucide-react'

export function CustomerDetails({ customerData }: { customerData: any }) {
  // Validate and provide defaults
  if (!customerData) {
    return (
      <div className="text-center text-gray-500 py-8">
        <p>No se pudieron cargar los datos del cliente</p>
      </div>
    )
  }

  const { 
    customer, 
    statistics = {
      totalSales: 0,
      totalInvoices: 0,
      ordersCount: 0,
      invoicesCount: 0,
      quotationsCount: 0,
    }, 
    recentOrders = [], 
    recentInvoices = [], 
    recentQuotations = [] 
  } = customerData

  if (!customer) {
    return (
      <div className="text-center text-gray-500 py-8">
        <p>Cliente no encontrado</p>
      </div>
    )
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PAGADA':
      case 'PAID':
      case 'ACCEPTED':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
      case 'EMITIDA':
      case 'ISSUED':
      case 'OPEN':
      case 'SENT':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
      case 'EN_COBRANZA':
      case 'PARCIAL':
      case 'PARTIAL':
      case 'DRAFT':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200'
      case 'ANULADA':
      case 'CANCELLED':
      case 'EXPIRED':
      case 'VOID':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200'
    }
  }

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      PAID: 'Pagado',
      OPEN: 'Abierto',
      DRAFT: 'Borrador',
      SENT: 'Enviado',
      ACCEPTED: 'Aceptado',
      EXPIRED: 'Expirado',
      CANCELLED: 'Cancelado',
      VOID: 'Anulado',
      ISSUED: 'Emitida',
    }
    return labels[status] || status
  }

  return (
    <div className="space-y-6">
      {/* Header Info */}
      <div className="grid grid-cols-2 gap-6">
        <div>
          <h2 className="text-2xl font-bold mb-4">{customer.name}</h2>
          <div className="space-y-2 text-sm">
            {customer.taxId && (
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-gray-400" />
                <span>NIT: {customer.taxId}</span>
              </div>
            )}
            {customer.email && (
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-gray-400" />
                <span>{customer.email}</span>
              </div>
            )}
            {customer.phone && (
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-gray-400" />
                <span>{customer.phone}</span>
              </div>
            )}
            {customer.address && (
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-gray-400" />
                <span>{customer.address}</span>
              </div>
            )}
            {customer.tags && customer.tags.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap">
                <Tag className="h-4 w-4 text-gray-400" />
                {customer.tags.map((tag: string, i: number) => (
                  <span key={i} className="px-2 py-0.5 text-xs bg-blue-100 text-blue-800 rounded">
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
        <div>
          <h3 className="font-semibold mb-3">Estadísticas</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Total Ventas:</span>
              <span className="font-semibold">{formatCurrency(statistics.totalSales)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Total Facturado:</span>
              <span className="font-semibold">{formatCurrency(statistics.totalInvoices)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Facturas:</span>
              <span className="font-semibold">{statistics.invoicesCount}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Cotizaciones:</span>
              <span className="font-semibold">{statistics.quotationsCount}</span>
            </div>
          </div>
        </div>
      </div>

      {customer.notes && (
        <div>
          <h3 className="font-semibold mb-2">Notas</h3>
          <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded">{customer.notes}</p>
        </div>
      )}

      {/* Tabs */}
      <Tabs defaultValue="invoices" className="w-full">
        <TabsList>
          <TabsTrigger value="invoices">Facturas</TabsTrigger>
          <TabsTrigger value="quotations">Cotizaciones</TabsTrigger>
        </TabsList>

        <TabsContent value="invoices" className="space-y-4">
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Número</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Pagado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentInvoices.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-gray-500">
                      No hay facturas
                    </TableCell>
                  </TableRow>
                ) : (
                  recentInvoices.map((invoice: any) => (
                    <TableRow key={invoice.id}>
                      <TableCell className="font-medium">{invoice.number}</TableCell>
                      <TableCell>{formatDate(invoice.createdAt)}</TableCell>
                      <TableCell>
                        <span className={`px-2 py-1 text-xs rounded ${getStatusColor(invoice.status)}`}>
                          {getStatusLabel(invoice.status)}
                        </span>
                      </TableCell>
                      <TableCell>{formatCurrency(invoice.total)}</TableCell>
                      <TableCell>
                        {invoice.paidAt ? formatDate(invoice.paidAt) : '-'}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="quotations" className="space-y-4">
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Número</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentQuotations.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-gray-500">
                      No hay cotizaciones
                    </TableCell>
                  </TableRow>
                ) : (
                  recentQuotations.map((quotation: any) => (
                    <TableRow key={quotation.id}>
                      <TableCell className="font-medium">{quotation.number}</TableCell>
                      <TableCell>{formatDate(quotation.createdAt)}</TableCell>
                      <TableCell>
                        <span className={`px-2 py-1 text-xs rounded ${getStatusColor(quotation.status)}`}>
                          {getStatusLabel(quotation.status)}
                        </span>
                      </TableCell>
                      <TableCell>{formatCurrency(quotation.total)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}

