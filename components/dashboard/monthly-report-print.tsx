'use client'

import { formatCurrency, formatDate } from '@/lib/utils'

export function MonthlyReportPrint({ report }: { report: any }) {
  const summary = report.summary || {}
  const salesByDay = report.salesByDay || []
  const salesByPaymentMethod = report.salesByPaymentMethod || {}
  const topProducts = report.topProducts || []

  const paymentMethodData = Object.entries(salesByPaymentMethod).map(([method, amount]) => ({
    name: method === 'CASH' ? 'Efectivo' : method === 'CARD' ? 'Tarjeta' : method === 'TRANSFER' ? 'Transferencia' : method,
    value: amount as number,
  }))

  return (
    <div className="thermal-ticket p-6 space-y-6">
      {/* Header */}
      <div className="text-center border-b pb-4">
        <h1 className="text-2xl font-bold mb-2">REPORTE MENSUAL DE VENTAS</h1>
        <p className="text-lg font-semibold">{report.period?.monthName || 'Mes actual'}</p>
        <p className="text-sm text-gray-600 mt-1">
          Generado: {formatDate(new Date())}
        </p>
      </div>

      {/* Resumen Principal */}
      <div className="border rounded-lg p-4 space-y-3">
        <h2 className="text-lg font-bold mb-3">RESUMEN FINANCIERO</h2>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="flex justify-between border-b pb-2">
            <span className="font-medium">Total Ventas:</span>
            <span className="font-bold text-green-600">{formatCurrency(summary.totalSales || 0)}</span>
          </div>
          <div className="flex justify-between border-b pb-2">
            <span className="font-medium">Subtotal sin Impuestos:</span>
            <span className="font-bold">{formatCurrency(summary.subtotalWithoutTaxes || 0)}</span>
          </div>
          <div className="flex justify-between border-b pb-2">
            <span className="font-medium">Total Impuestos (IVA):</span>
            <span className="font-bold text-orange-600">{formatCurrency(summary.totalTaxes || 0)}</span>
          </div>
          <div className="flex justify-between border-b pb-2">
            <span className="font-medium">Costo de Mercancía Vendida:</span>
            <span className="font-bold">{formatCurrency(summary.costOfGoodsSold || 0)}</span>
          </div>
          <div className="flex justify-between border-b pb-2">
            <span className="font-medium">Ganancia Neta:</span>
            <span className={`font-bold ${(summary.totalProfit || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatCurrency(summary.totalProfit || 0)}
            </span>
          </div>
          <div className="flex justify-between border-b pb-2">
            <span className="font-medium">Margen de Ganancia:</span>
            <span className="font-bold">{summary.profitMargin || 0}%</span>
          </div>
        </div>
      </div>

      {/* Estadísticas Generales */}
      <div className="border rounded-lg p-4">
        <h2 className="text-lg font-bold mb-3">ESTADÍSTICAS GENERALES</h2>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-600">Total Facturas:</span>
            <span className="font-semibold ml-2">{summary.totalInvoices || 0}</span>
          </div>
          <div>
            <span className="text-gray-600">Promedio por Factura:</span>
            <span className="font-semibold ml-2">{formatCurrency(summary.averageInvoiceValue || 0)}</span>
          </div>
          <div>
            <span className="text-gray-600">Artículos Vendidos:</span>
            <span className="font-semibold ml-2">{summary.totalItemsSold || 0}</span>
          </div>
        </div>
      </div>

      {/* Ventas por Método de Pago */}
      {paymentMethodData.length > 0 && (
        <div className="border rounded-lg p-4">
          <h2 className="text-lg font-bold mb-3">VENTAS POR MÉTODO DE PAGO</h2>
          <div className="space-y-2 text-sm">
            {paymentMethodData.map((item, index) => (
              <div key={index} className="flex justify-between border-b pb-1">
                <span>{item.name}:</span>
                <span className="font-semibold">{formatCurrency(item.value)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Ventas por Día */}
      <div className="border rounded-lg p-4">
        <h2 className="text-lg font-bold mb-3">VENTAS POR DÍA</h2>
        <div className="space-y-1 text-xs">
          {salesByDay.map((day: any) => (
            <div key={day.date} className="flex justify-between">
              <span>Día {day.day}:</span>
              <span>{formatCurrency(day.sales)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Top Productos */}
      {topProducts.length > 0 && (
        <div className="border rounded-lg p-4">
          <h2 className="text-lg font-bold mb-3">TOP 10 PRODUCTOS VENDIDOS</h2>
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b">
                <th className="text-left p-1">Producto</th>
                <th className="text-right p-1">Cant.</th>
                <th className="text-right p-1">Ingresos</th>
                <th className="text-right p-1">Ganancia</th>
              </tr>
            </thead>
            <tbody>
              {topProducts.slice(0, 10).map((product: any) => (
                <tr key={product.id} className="border-b">
                  <td className="p-1">{product.name}</td>
                  <td className="text-right p-1">{product.quantity}</td>
                  <td className="text-right p-1">{formatCurrency(product.revenue)}</td>
                  <td className={`text-right p-1 ${product.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatCurrency(product.profit)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Footer */}
      <div className="text-center text-xs text-gray-600 border-t pt-4">
        <p>Reporte generado automáticamente por Sistema de Ferretería</p>
        <p>Fecha: {formatDate(new Date())}</p>
      </div>
    </div>
  )
}

