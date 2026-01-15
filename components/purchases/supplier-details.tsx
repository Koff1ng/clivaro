'use client'

import { formatCurrency, formatDate } from '@/lib/utils'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Mail, Phone, MapPin, FileText, Package, Receipt, Building2, TrendingUp } from 'lucide-react'

export function SupplierDetails({ supplierData }: { supplierData: any }) {
  // Validación de datos
  if (!supplierData || !supplierData.supplier) {
    return (
      <div className="text-center py-8 text-gray-500">
        <p>No se pudo cargar la información del proveedor</p>
      </div>
    )
  }

  const { supplier, statistics, recentOrders, recentReceipts } = supplierData

  // Valores por defecto para evitar errores
  const safeSupplier = supplier || {}
  const safeStatistics = statistics || {
    totalPurchases: 0,
    totalReceipts: 0,
    ordersCount: 0,
    receiptsCount: 0,
  }
  const safeOrders = recentOrders || []
  const safeReceipts = recentReceipts || []

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'RECEIVED':
        return 'bg-green-100 text-green-800'
      case 'SENT':
        return 'bg-blue-100 text-blue-800'
      case 'DRAFT':
        return 'bg-gray-100 text-gray-800'
      case 'CANCELLED':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      DRAFT: 'Borrador',
      SENT: 'Enviada',
      RECEIVED: 'Recibida',
      CANCELLED: 'Cancelada',
    }
    return labels[status] || status
  }

  return (
    <div className="space-y-6">
      {/* Header Info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-lg border shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Building2 className="h-6 w-6 text-blue-600" />
            </div>
            <h2 className="text-2xl font-bold">{safeSupplier.name || 'Sin nombre'}</h2>
          </div>
          <div className="space-y-3 text-sm">
            {safeSupplier.taxId && (
              <div className="flex items-center gap-2 text-gray-700">
                <FileText className="h-4 w-4 text-gray-400" />
                <span className="font-medium">NIT:</span>
                <span>{safeSupplier.taxId}</span>
              </div>
            )}
            {safeSupplier.email && (
              <div className="flex items-center gap-2 text-gray-700">
                <Mail className="h-4 w-4 text-gray-400" />
                <a href={`mailto:${safeSupplier.email}`} className="text-blue-600 hover:underline">
                  {safeSupplier.email}
                </a>
              </div>
            )}
            {safeSupplier.phone && (
              <div className="flex items-center gap-2 text-gray-700">
                <Phone className="h-4 w-4 text-gray-400" />
                <a href={`tel:${safeSupplier.phone}`} className="text-blue-600 hover:underline">
                  {safeSupplier.phone}
                </a>
              </div>
            )}
            {safeSupplier.address && (
              <div className="flex items-start gap-2 text-gray-700">
                <MapPin className="h-4 w-4 text-gray-400 mt-0.5" />
                <span>{safeSupplier.address}</span>
              </div>
            )}
            {safeSupplier.active !== false && (
              <div className="pt-2">
                <span className="px-3 py-1 text-xs bg-green-100 text-green-800 rounded-full font-medium">
                  Activo
                </span>
              </div>
            )}
          </div>
        </div>
        
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-6 rounded-lg border shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="h-5 w-5 text-blue-600" />
            <h3 className="font-semibold text-lg">Estadísticas</h3>
          </div>
          <div className="space-y-4">
            <div className="bg-white p-3 rounded-lg shadow-sm">
              <div className="flex justify-between items-center">
                <span className="text-gray-600 text-sm">Total Compras</span>
                <span className="font-bold text-lg text-blue-600">
                  {formatCurrency(safeStatistics.totalPurchases)}
                </span>
              </div>
            </div>
            <div className="bg-white p-3 rounded-lg shadow-sm">
              <div className="flex justify-between items-center">
                <span className="text-gray-600 text-sm">Total Recepciones</span>
                <span className="font-bold text-lg text-green-600">
                  {formatCurrency(safeStatistics.totalReceipts)}
                </span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white p-3 rounded-lg shadow-sm text-center">
                <div className="text-2xl font-bold text-blue-600">{safeStatistics.ordersCount}</div>
                <div className="text-xs text-gray-500 mt-1">Órdenes</div>
              </div>
              <div className="bg-white p-3 rounded-lg shadow-sm text-center">
                <div className="text-2xl font-bold text-green-600">{safeStatistics.receiptsCount}</div>
                <div className="text-xs text-gray-500 mt-1">Recepciones</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {safeSupplier.notes && (
        <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-lg">
          <h3 className="font-semibold mb-2 text-yellow-900">Notas</h3>
          <p className="text-sm text-yellow-800">{safeSupplier.notes}</p>
        </div>
      )}

      {/* Tabs */}
      <div className="bg-white rounded-lg border shadow-sm">
        <Tabs defaultValue="orders" className="w-full">
          <TabsList className="w-full justify-start border-b bg-transparent p-0 h-auto">
            <TabsTrigger 
              value="orders" 
              className="px-6 py-3 data-[state=active]:border-b-2 data-[state=active]:border-blue-600 data-[state=active]:bg-transparent"
            >
              <Package className="h-4 w-4 mr-2" />
              Órdenes de Compra ({safeOrders.length})
            </TabsTrigger>
            <TabsTrigger 
              value="receipts"
              className="px-6 py-3 data-[state=active]:border-b-2 data-[state=active]:border-blue-600 data-[state=active]:bg-transparent"
            >
              <Receipt className="h-4 w-4 mr-2" />
              Recepciones ({safeReceipts.length})
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="orders" className="p-0 m-0">
            <div className="border-t">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50">
                    <TableHead className="font-semibold">Número</TableHead>
                    <TableHead className="font-semibold">Fecha</TableHead>
                    <TableHead className="font-semibold">Estado</TableHead>
                    <TableHead className="font-semibold text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {safeOrders.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-gray-500 py-8">
                        <Package className="h-12 w-12 mx-auto mb-2 text-gray-300" />
                        <p>No hay órdenes de compra registradas</p>
                      </TableCell>
                    </TableRow>
                  ) : (
                    safeOrders.map((order: any) => (
                      <TableRow key={order.id} className="hover:bg-gray-50">
                        <TableCell className="font-medium">{order.number || '-'}</TableCell>
                        <TableCell>{order.createdAt ? formatDate(order.createdAt) : '-'}</TableCell>
                        <TableCell>
                          <span className={`px-2 py-1 text-xs rounded-full font-medium ${getStatusColor(order.status || 'DRAFT')}`}>
                            {getStatusLabel(order.status || 'DRAFT')}
                          </span>
                        </TableCell>
                        <TableCell className="text-right font-semibold">
                          {formatCurrency(order.total || 0)}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          <TabsContent value="receipts" className="p-0 m-0">
            <div className="border-t">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50">
                    <TableHead className="font-semibold">Número</TableHead>
                    <TableHead className="font-semibold">Fecha</TableHead>
                    <TableHead className="font-semibold text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {safeReceipts.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center text-gray-500 py-8">
                        <Receipt className="h-12 w-12 mx-auto mb-2 text-gray-300" />
                        <p>No hay recepciones registradas</p>
                      </TableCell>
                    </TableRow>
                  ) : (
                    safeReceipts.map((receipt: any) => (
                      <TableRow key={receipt.id} className="hover:bg-gray-50">
                        <TableCell className="font-medium">{receipt.number || '-'}</TableCell>
                        <TableCell>{receipt.createdAt ? formatDate(receipt.createdAt) : '-'}</TableCell>
                        <TableCell className="text-right font-semibold">
                          {formatCurrency(receipt.total || 0)}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}

