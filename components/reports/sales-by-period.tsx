'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ReportLayout } from '@/components/reports/report-layout'
import { DateRangeFilter, DateRange } from '@/components/reports/date-range-filter'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCurrency } from '@/lib/utils'
import { DollarSign, TrendingUp, FileText, Package } from 'lucide-react'
import { subDays } from 'date-fns'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, AreaChart, Area } from 'recharts'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

async function fetchSalesByPeriod(from: Date, to: Date) {
    const params = new URLSearchParams({
        from: from.toISOString(),
        to: to.toISOString(),
    })
    const res = await fetch(`/api/reports/sales-by-period?${params}`)
    if (!res.ok) throw new Error('Failed to fetch report')
    return res.json()
}

export function SalesByPeriodReport() {
    const [dateRange, setDateRange] = useState<DateRange>({
        from: subDays(new Date(), 29),
        to: new Date(),
    })
    const [searchTerm, setSearchTerm] = useState('')

    const { data, isLoading, error } = useQuery({
        queryKey: ['sales-by-period', dateRange.from.toISOString(), dateRange.to.toISOString()],
        queryFn: () => fetchSalesByPeriod(dateRange.from, dateRange.to),
    })

    const filteredProducts = (data?.topProducts || []).filter((p: any) =>
        p.name.toLowerCase().includes(searchTerm.toLowerCase())
    )

    const handlePrint = () => {
        window.print()
    }

    const handleExport = () => {
        const csvContent = [
            ['Día', 'Ventas', 'Facturas'],
            ...((data?.salesByDay || []).map((day: any) => [
                day.date,
                day.sales,
                day.count,
            ])),
        ]
            .map(row => row.join(','))
            .join('\n')

        const blob = new Blob([csvContent], { type: 'text/csv' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `ventas-por-periodo-${dateRange.from.toISOString().split('T')[0]}.csv`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
    }

    return (
        <ReportLayout
            title="Ventas por Período"
            description="Análisis detallado de ventas en el período seleccionado"
            onPrint={handlePrint}
            onExport={handleExport}
            filters={
                <div className="flex flex-wrap items-center gap-4">
                    <DateRangeFilter value={dateRange} onChange={setDateRange} />
                    <div className="flex-1 min-w-[200px]">
                        <input
                            type="text"
                            placeholder="Buscar en top productos..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                        />
                    </div>
                </div>
            }
        >
            {isLoading && (
                <div className="text-center py-12">
                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                    <p className="mt-2 text-muted-foreground">Cargando reporte...</p>
                </div>
            )}

            {error && (
                <Card>
                    <CardContent className="pt-6">
                        <p className="text-destructive">Error al cargar el reporte. Intente nuevamente.</p>
                    </CardContent>
                </Card>
            )}

            {data && (
                <div className="space-y-6">
                    {/* Summary Cards */}
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Ventas Netas</CardTitle>
                                <DollarSign className="h-4 w-4 text-primary" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold text-blue-600">
                                    {formatCurrency(data.summary.totalNetSales)}
                                </div>
                                <p className="text-xs text-muted-foreground mt-1">
                                    Sin impuestos. {data.summary.totalInvoices} facturas.
                                </p>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Ganancia Real</CardTitle>
                                <TrendingUp className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <div className={`text-2xl font-bold ${data.summary.totalProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                    {formatCurrency(data.summary.totalProfit)}
                                </div>
                                <p className="text-xs text-muted-foreground mt-1">
                                    Margen: {data.summary.profitMargin.toFixed(1)}% (Sobre neto)
                                </p>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Retorno/Descuentos</CardTitle>
                                <FileText className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold text-orange-600">
                                    {formatCurrency(data.summary.totalReturns + data.summary.totalDiscounts)}
                                </div>
                                <p className="text-xs text-muted-foreground mt-1">
                                    -{formatCurrency(data.summary.totalReturns)} devoluciones
                                </p>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Ventas Brutas</CardTitle>
                                <Package className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">
                                    {formatCurrency(data.summary.totalSales)}
                                </div>
                                <p className="text-xs text-muted-foreground mt-1">
                                    Incluye IVA: {formatCurrency(data.summary.totalTax)}
                                </p>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Sales Chart */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Ventas Diarias (Bruto vs Neto)</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="h-[300px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={data.salesByDay}>
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis
                                            dataKey="date"
                                            tickFormatter={(val) => format(new Date(val), 'dd MMM', { locale: es })}
                                        />
                                        <YAxis tickFormatter={(val) => `$${val / 1000}k`} />
                                        <Tooltip
                                            labelFormatter={(val) => format(new Date(val), 'PPPP', { locale: es })}
                                            formatter={(value: any) => formatCurrency(value)}
                                        />
                                        <Legend />
                                        <Area type="monotone" dataKey="sales" stroke="#10b981" fill="#10b981" fillOpacity={0.2} name="Ventas Brutas" />
                                        <Area type="monotone" dataKey="netSales" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.4} name="Ventas Netas" />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Top Products */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Top 10 Productos</CardTitle>
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
                                            <th className="text-right p-2">Ganancia</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredProducts.slice(0, 10).map((product: any, index: number) => (
                                            <tr key={product.id} className="border-b hover:bg-muted/50">
                                                <td className="p-2">{index + 1}</td>
                                                <td className="p-2 font-medium">{product.name}</td>
                                                <td className="text-right p-2">{product.quantity}</td>
                                                <td className="text-right p-2 font-medium">{formatCurrency(product.revenue)}</td>
                                                <td className={`text-right p-2 font-semibold ${product.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                    {formatCurrency(product.profit)}
                                                </td>
                                            </tr>
                                        ))}
                                        {filteredProducts.length === 0 && (
                                            <tr>
                                                <td colSpan={5} className="p-8 text-center text-muted-foreground">
                                                    No se encontraron productos.
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Sales by Payment Method */}
                    {Object.keys(data.salesByPaymentMethod).length > 0 && (
                        <Card>
                            <CardHeader>
                                <CardTitle>Ventas por Método de Pago</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-2">
                                    {Object.entries(data.salesByPaymentMethod).map(([method, amount]) => {
                                        const methodName = method === 'CASH' ? 'Efectivo' : method === 'CARD' ? 'Tarjeta' : method === 'TRANSFER' ? 'Transferencia' : method
                                        const percentage = ((amount as number / data.summary.totalSales) * 100).toFixed(1)
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

                    {/* Sales by Seller */}
                    {data.salesBySeller.length > 0 && (
                        <Card>
                            <CardHeader>
                                <CardTitle>Ventas por Vendedor</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-2">
                                    {data.salesBySeller.map((seller: any) => (
                                        <div key={seller.sellerId} className="flex items-center justify-between border-b pb-2">
                                            <span className="font-medium">{seller.sellerName}</span>
                                            <div className="text-right">
                                                <span className="font-bold">{formatCurrency(seller.sales)}</span>
                                                <span className="text-sm text-muted-foreground ml-2">({seller.invoiceCount} facturas)</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    )}
                </div>
            )}
        </ReportLayout>
    )
}
