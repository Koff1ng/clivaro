'use client'

import { formatCurrency, formatDate } from '@/lib/utils'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Mail, Phone, MapPin, FileText, Package, Building2 } from 'lucide-react'

export function ReceiptDetails({ receipt }: { receipt: any }) {
  // Validate and provide defaults
  if (!receipt) {
    return <div className="text-center text-gray-500 p-4">No hay datos de recepción disponibles</div>
  }

  const receiptData = {
    number: receipt.number || 'N/A',
    receivedAt: receipt.receivedAt || receipt.createdAt,
    purchaseOrder: receipt.purchaseOrder || null,
    warehouse: receipt.warehouse || null,
    items: receipt.items || [],
    notes: receipt.notes || null,
    total: receipt.total || 0,
    createdBy: receipt.createdBy || null,
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-2xl font-bold">{receiptData.number}</h2>
          <div className="mt-2 text-sm text-gray-600">
            Fecha de Recepción: {formatDate(receiptData.receivedAt)}
          </div>
        </div>
      </div>

      {/* Order and Supplier Info */}
      <div className="grid grid-cols-2 gap-6">
        <div>
          <h3 className="font-semibold mb-3">Orden de Compra</h3>
          <div className="space-y-2 text-sm">
            {receiptData.purchaseOrder ? (
              <>
                <div className="font-medium">{receiptData.purchaseOrder.number || 'N/A'}</div>
                {receiptData.purchaseOrder.supplier && (
                  <>
                    <div className="font-medium mt-3">Proveedor</div>
                    <div>{receiptData.purchaseOrder.supplier.name || 'N/A'}</div>
                    {receiptData.purchaseOrder.supplier.taxId && (
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-gray-400" />
                        <span>NIT: {receiptData.purchaseOrder.supplier.taxId}</span>
                      </div>
                    )}
                    {receiptData.purchaseOrder.supplier.email && (
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4 text-gray-400" />
                        <span>{receiptData.purchaseOrder.supplier.email}</span>
                      </div>
                    )}
                    {receiptData.purchaseOrder.supplier.phone && (
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4 text-gray-400" />
                        <span>{receiptData.purchaseOrder.supplier.phone}</span>
                      </div>
                    )}
                  </>
                )}
              </>
            ) : (
              <div className="text-gray-500">No hay información de orden de compra</div>
            )}
          </div>
        </div>
        <div>
          <h3 className="font-semibold mb-3">Almacén</h3>
          <div className="space-y-2 text-sm">
            {receiptData.warehouse ? (
              <>
                <div className="flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-blue-600" />
                  <div>
                    <div className="font-medium">{receiptData.warehouse.name || 'N/A'}</div>
                    {receiptData.warehouse.address && (
                      <div className="text-gray-600 text-xs mt-1">
                        <MapPin className="h-3 w-3 inline mr-1" />
                        {receiptData.warehouse.address}
                      </div>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <div className="text-gray-500">No hay información de almacén</div>
            )}
            {receiptData.createdBy && (
              <div className="mt-3 text-xs text-gray-500">
                Creado por: {receiptData.createdBy.name || 'N/A'}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Items */}
      <div>
        <h3 className="font-semibold mb-3">Productos Recibidos</h3>
        {receiptData.items.length > 0 ? (
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Producto</TableHead>
                  <TableHead>Cantidad</TableHead>
                  <TableHead>Costo Unit.</TableHead>
                  <TableHead>Subtotal</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {receiptData.items.map((item: any) => {
                  const quantity = item.quantity || 0
                  const unitCost = item.unitCost || 0
                  const subtotal = quantity * unitCost
                  return (
                    <TableRow key={item.id || Math.random()}>
                      <TableCell className="font-mono text-xs">
                        {item.product?.sku || '-'}
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{item.product?.name || 'Producto sin nombre'}</div>
                          {item.variant && (
                            <div className="text-xs text-gray-500">{item.variant.name}</div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{quantity}</TableCell>
                      <TableCell>{formatCurrency(unitCost)}</TableCell>
                      <TableCell>{formatCurrency(subtotal)}</TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="text-center text-gray-500 p-4 border rounded-lg">
            No hay productos en esta recepción
          </div>
        )}
      </div>

      {/* Totals */}
      <div className="flex justify-end">
        <div className="w-64 space-y-2 text-sm">
          <div className="flex justify-between border-t pt-2 font-bold text-lg">
            <span>Total:</span>
            <span>{formatCurrency(receiptData.total)}</span>
          </div>
        </div>
      </div>

      {receiptData.notes && (
        <div>
          <h3 className="font-semibold mb-2">Notas</h3>
          <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded">{receiptData.notes}</p>
        </div>
      )}
    </div>
  )
}

