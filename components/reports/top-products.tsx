'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ReportLayout } from '@/components/reports/report-layout'
import { DateRangeFilter, DateRange } from '@/components/reports/date-range-filter'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCurrency } from '@/lib/utils'
import { subDays } from 'date-fns'
import { Package, TrendingUp, DollarSign } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'

async function fetchTopProducts(from: Date, to: Date) {
    const params = new URLSearchParams({
        from: from.toISOString(),
        to: to.toISOString(),
        limit: '50',
    })
    const res = await fetch(`/api/dashboard/top-products?${params}`)
    if (!res.ok) throw new Error('Failed to fetch report')
    return res.json()
}

export function TopProductsReport() {
    const [dateRange, setDateRange] = useState<DateRange>({
        from: subDays(new Date(), 29),
        to: new Date(),
    })
    const [view, setView] = useState<'revenue' | 'quantity'>('revenue')

    const { data, isLoading, error } = useQuery({
        queryKey: ['top-products', dateRange.from.toISOString(), dateRange.to.toISOString()],
        queryFn: () => fetchTopProducts(dateRange.from, dateRange.to),
    })

    const handlePrint = () => {
        window.print()
    }

    const handleExport = () => {
        const csvContent = [
            ['Producto', 'SKU', 'Categoría', 'Cantidad', 'Ingresos', 'Costo', 'Ganancia'],
            ...((data?.products || []).map((product: any) => [
                product.name,
                product.sku,
                product.category || 'Sin categoría',
                product.quantity,
                product.revenue,
                product.cost,
                product.profit,
            ])),
        ]
            .map(row => row.join(','))
            .join('\n')

        const blob = new Blob([csvContent], { type: 'text/csv' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `top-productos-${dateRange.from.toISOString().split('T')[0]}.csv`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
    }

    const topProductsByView = data?.products
        ? [...data.products].sort((a: any, b: any) => {
            return view === 'revenue' ? b.revenue - a.revenue : b.quantity - a.quantity
        })
        : []

    const chartData = (topProductsByView || []).slice(0, 10).reverse()

    return (
        <ReportLayout
            title="Productos Más Vendidos"
            description="Top productos por ventas y cantidad en el período seleccionado"
            onPrint={handlePrint}
            onExport={handleExport}
            filters={
                <div className="space-y-4">
                    <DateRangeFilter value={dateRange} onChange={setDateRange} />
                    <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">Ordenar por:</span>
                        <button
                            onClick={() => setView('revenue')}
                            className={`px-3 py-1 rounded text-sm ${view === 'revenue' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}
                        >
                            Ingresos
                        </button>
                        <button
                            onClick={() => setView('quantity')}
                            className={`px-3 py-1 rounded text-sm ${view === 'quantity' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}
                        >
                            Cantidad
                        </button>
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
                    <div className="grid gap-4 md:grid-cols-3">
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Total Ingresos</CardTitle>
                                <DollarSign className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold text-green-600">
                                    {formatCurrency(
                                        data.products.reduce((sum: number, p: any) => sum + p.revenue, 0)
                                    )}
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Total Ganancia</CardTitle>
                                <TrendingUp className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold text-green-600">
                                    {formatCurrency(
                                        data.products.reduce((sum: number, p: any) => sum + p.profit, 0)
                                    )}
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Productos Vendidos</CardTitle>
                                <Package className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">
                                    {data.products.reduce((sum: number, p: any) => sum + p.quantity, 0)}
                                </div>
                                <p className="text-xs text-muted-foreground mt-1">
                                    {data.products.length} productos diferentes
                                </p>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Chart */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Top 10 Productos por {view === 'revenue' ? 'Ingresos' : 'Cantidad'}</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <ResponsiveContainer width="100%" height={400}>
                                <BarChart data={chartData} layout="vertical">
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis type="number" />
                                    <YAxis dataKey="name" type="category" width={150} />
                                    <Tooltip formatter={(value: any) => view === 'revenue' ? formatCurrency(value) : value} />
                                    <Legend />
                                    <Bar
                                        dataKey={view === 'revenue' ? 'revenue' : 'quantity'}
                                        fill="#10b981"
                                        name={view === 'revenue' ? 'Ingresos' : 'Cantidad'}
                                    />
                                </BarChart>
                            </ResponsiveContainer>
                        </CardContent>
                    </Card>

                    {/* Products Table */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Todos los Productos</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b">
                                            <th className="text-left p-2">#</th>
                                            <th className="text-left p-2">Producto</th>
                                            <th className="text-left p-2">Categoría</th>
                                            <th className="text-right p-2">Cantidad</th>
                                            <th className="text-right p-2">Ingresos</th>
                                            <th className="text-right p-2">Costo</th>
                                            <th className="text-right p-2">Ganancia</th>
                                            <th className="text-right p-2">Margen %</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {topProductsByView.map((product: any, index: number) => {
                                            const margin = product.revenue > 0 ? ((product.profit / product.revenue) * 100).toFixed(1) : '0'
                                            return (
                                                <tr key={product.id} className="border-b hover:bg-muted/50">
                                                    <td className="p-2">{index + 1}</td>
                                                    <td className="p-2 font-medium">{product.name}</td>
                                                    <td className="p-2 text-muted-foreground">{product.category || '-'}</td>
                                                    <td className="text-right p-2">{product.quantity}</td>
                                                    <td className="text-right p-2">{formatCurrency(product.revenue)}</td>
                                                    <td className="text-right p-2">{formatCurrency(product.cost)}</td>
                                                    <td className={`text-right p-2 font-semibold ${product.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                        {formatCurrency(product.profit)}
                                                    </td>
                                                    <td className="text-right p-2">{margin}%</td>
                                                </tr>
                                            )
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}
        </ReportLayout>
    )
}
