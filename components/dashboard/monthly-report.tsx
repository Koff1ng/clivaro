'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { formatCurrency, formatDate } from '@/lib/utils'
import { Printer, Download, DollarSign, Package } from 'lucide-react'
import { MonthlyReportPrint } from './monthly-report-print'

async function fetchMonthlyReport(year: number, month: number) {
  const params = new URLSearchParams({
    year: year.toString(),
    month: month.toString(),
  })
  const res = await fetch(`/api/dashboard/monthly-report?${params}`)
  if (!res.ok) throw new Error('Failed to fetch monthly report')
  return res.json()
}

export function MonthlyReport() {
  const [isOpen, setIsOpen] = useState(false)
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1)

  const { data, isLoading } = useQuery({
    queryKey: ['monthly-report', selectedYear, selectedMonth],
    queryFn: () => fetchMonthlyReport(selectedYear, selectedMonth),
    enabled: isOpen,
  })

  const handlePrint = () => {
    window.print()
  }

  const handleDownload = () => {
    // Crear contenido para descargar
    const content = JSON.stringify(data, null, 2)
    const blob = new Blob([content], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `reporte-mensual-${selectedYear}-${String(selectedMonth).padStart(2, '0')}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  if (!isOpen) {
    return (
      <Button
        onClick={() => setIsOpen(true)}
        className="w-full max-w-md"
        variant="outline"
      >
        <Printer className="h-4 w-4 mr-2" />
        Imprimir Cierre Mensual
      </Button>
    )
  }

  if (isLoading) {
    return (
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <div className="p-8 text-center">Cargando reporte...</div>
        </DialogContent>
      </Dialog>
    )
  }

  const report = data || {}
  const summary = report.summary || {}
  const salesByDay = report.salesByDay || []
  const salesByPaymentMethod = report.salesByPaymentMethod || {}
  const topProducts = report.topProducts || []

  return (
    <>
      {/* Vista para impresión - oculta en pantalla */}
      <div className="hidden print:block">
        <MonthlyReportPrint report={report} />
      </div>

      {/* Vista normal en pantalla */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto print:hidden">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle className="text-2xl">Reporte Mensual de Ventas</DialogTitle>
                <p className="text-sm text-gray-600 mt-1">
                  {report.period?.monthName || 'Mes actual'}
                </p>
              </div>
              <div className="flex gap-2">
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                  className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map(year => (
                    <option key={year} value={year}>{year}</option>
                  ))}
                </select>
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                  className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  {Array.from({ length: 12 }, (_, i) => i + 1).map(month => {
                    const monthNames = [
                      'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
                      'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
                    ]
                    return (
                      <option key={month} value={month}>
                        {monthNames[month - 1]}
                      </option>
                    )
                  })}
                </select>
                <Button variant="outline" onClick={handlePrint}>
                  <Printer className="h-4 w-4 mr-2" />
                  Imprimir
                </Button>
                <Button variant="outline" onClick={handleDownload}>
                  <Download className="h-4 w-4 mr-2" />
                  Descargar
                </Button>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-6 mt-4">
            {/* Resumen Principal */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Ventas</CardTitle>
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600">
                    {formatCurrency(summary.totalSales || 0)}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Ganancia Neta</CardTitle>
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className={`text-2xl font-bold ${(summary.totalProfit || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatCurrency(summary.totalProfit || 0)}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Margen: {summary.profitMargin || 0}%
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Facturas</CardTitle>
                  <Package className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {summary.totalInvoices || 0}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Promedio: {formatCurrency(summary.averageInvoiceValue || 0)}
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Resumen Financiero Detallado */}
            <Card>
              <CardHeader>
                <CardTitle>Resumen Financiero</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground mb-1">Total Ventas</p>
                      <p className="text-lg font-bold text-green-600">{formatCurrency(summary.totalSales || 0)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground mb-1">Subtotal sin Impuestos</p>
                      <p className="text-lg font-bold">{formatCurrency(summary.subtotalWithoutTaxes || 0)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground mb-1">Total Impuestos (IVA)</p>
                      <p className="text-lg font-bold text-orange-600">{formatCurrency(summary.totalTaxes || 0)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground mb-1">Costo de Mercancía Vendida</p>
                      <p className="text-lg font-bold">{formatCurrency(summary.costOfGoodsSold || 0)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground mb-1">Ganancia Neta</p>
                      <p className={`text-lg font-bold ${(summary.totalProfit || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatCurrency(summary.totalProfit || 0)}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground mb-1">Margen de Ganancia</p>
                      <p className="text-lg font-bold">{summary.profitMargin || 0}%</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground mb-1">Total Facturas</p>
                      <p className="text-lg font-bold">{summary.totalInvoices || 0}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground mb-1">Promedio por Factura</p>
                      <p className="text-lg font-bold">{formatCurrency(summary.averageInvoiceValue || 0)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground mb-1">Artículos Vendidos</p>
                      <p className="text-lg font-bold">{summary.totalItemsSold || 0}</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Ventas por Método de Pago */}
            {Object.keys(salesByPaymentMethod).length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Ventas por Método de Pago</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {Object.entries(salesByPaymentMethod).map(([method, amount]) => {
                      const methodName = method === 'CASH' ? 'Efectivo' : method === 'CARD' ? 'Tarjeta' : method === 'TRANSFER' ? 'Transferencia' : method
                      const percentage = summary.totalSales > 0 ? ((amount as number / summary.totalSales) * 100).toFixed(1) : '0'
                      return (
                        <div key={method} className="flex items-center justify-between border-b pb-2">
                          <span className="font-medium">{methodName}</span>
                          <div className="text-right">
                            <span className="font-bold">{formatCurrency(amount as number)}</span>
                            <span className="text-sm text-muted-foreground ml-2">({percentage}%)</span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Ventas por Día */}
            <Card>
              <CardHeader>
                <CardTitle>Ventas por Día</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-1 text-sm max-h-96 overflow-y-auto">
                  {salesByDay.map((day: any) => (
                    <div key={day.date} className="flex items-center justify-between border-b pb-1">
                      <span>Día {day.day}:</span>
                      <span className="font-semibold">{formatCurrency(day.sales)}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Top Productos */}
            {topProducts.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Top 10 Productos Vendidos</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left p-2">#</th>
                          <th className="text-left p-2">Producto</th>
                          <th className="text-right p-2">Cantidad</th>
                          <th className="text-right p-2">Ingresos</th>
                          <th className="text-right p-2">Costo</th>
                          <th className="text-right p-2">Ganancia</th>
                        </tr>
                      </thead>
                      <tbody>
                        {topProducts.slice(0, 10).map((product: any, index: number) => (
                          <tr key={product.id} className="border-b">
                            <td className="p-2">{index + 1}</td>
                            <td className="p-2">{product.name}</td>
                            <td className="text-right p-2">{product.quantity}</td>
                            <td className="text-right p-2">{formatCurrency(product.revenue)}</td>
                            <td className="text-right p-2">{formatCurrency(product.cost)}</td>
                            <td className={`text-right p-2 font-semibold ${product.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {formatCurrency(product.profit)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
