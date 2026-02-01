'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ReportLayout } from '@/components/reports/report-layout'
import { DateRangeFilter, DateRange } from '@/components/reports/date-range-filter'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCurrency } from '@/lib/utils'
import { subDays, format } from 'date-fns'
import { es } from 'date-fns/locale'
import { Package, TrendingUp, DollarSign, Search } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'

async function fetchTopProducts(from: Date, to: Date) {
    const params = new URLSearchParams({
        from: from.toISOString(),
        to: to.toISOString(),
        limit: '50',
    })
    const res = await fetch(`/api/reports/top-products?${params}`)
    if (!res.ok) throw new Error('Failed to fetch report')
    return res.json()
}

export function TopProductsReport() {
    const [dateRange, setDateRange] = useState<DateRange>({
        from: subDays(new Date(), 29),
        to: new Date(),
    })
    const [view, setView] = useState<'revenue' | 'quantity'>('revenue')
    const [searchTerm, setSearchTerm] = useState('')

    const { data, isLoading, error } = useQuery({
        queryKey: ['top-products', dateRange.from.toISOString(), dateRange.to.toISOString()],
        queryFn: () => fetchTopProducts(dateRange.from, dateRange.to),
    })

    const filteredItems = (data?.products || []).filter((item: any) =>
        item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.sku.toLowerCase().includes(searchTerm.toLowerCase())
    )

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

    const topProductsByView = [...filteredItems].sort((a: any, b: any) => {
        return view === 'revenue' ? b.revenue - a.revenue : b.quantity - a.quantity
    })

    const chartData = topProductsByView.slice(0, 10).reverse()

    return (
        <ReportLayout
            title="Productos Más Vendidos"
            description="Top productos por ventas y cantidad en el período seleccionado"
            onPrint={handlePrint}
            onExport={handleExport}
            filters={
                <div className="flex flex-wrap items-center gap-4">
                    <DateRangeFilter value={dateRange} onChange={setDateRange} />
                    <div className="flex items-center gap-2 bg-muted p-1 rounded-md">
                        <button
                            onClick={() => setView('revenue')}
                            className={`px-3 py-1 rounded text-xs transition-colors ${view === 'revenue' ? 'bg-primary text-primary-foreground shadow-sm' : 'hover:bg-muted-foreground/10'}`}
                        >
                            Por Ingresos
                        </button>
                        <button
                            onClick={() => setView('quantity')}
                            className={`px-3 py-1 rounded text-xs transition-colors ${view === 'quantity' ? 'bg-primary text-primary-foreground shadow-sm' : 'hover:bg-muted-foreground/10'}`}
                        >
                            Por Cantidad
                        </button>
                    </div>
                    <div className="flex-1 min-w-[200px]">
                        <div className="relative">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <input
                                type="text"
                                placeholder="Buscar producto..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="flex h-9 w-full rounded-md border border-input bg-background pl-8 pr-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                            />
                        </div>
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
                                    {formatCurrency(data.summary.totalRevenue)}
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
                                    {formatCurrency(data.summary.totalProfit)}
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
                                    {data.summary.totalQuantity}
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
                            <div className="h-[400px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={chartData} layout="vertical">
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis type="number" />
                                        <YAxis dataKey="name" type="category" width={150} tick={{ fontSize: 12 }} />
                                        <Tooltip
                                            formatter={(value: any) => view === 'revenue' ? formatCurrency(value) : value}
                                            contentStyle={{ backgroundColor: 'hsl(var(--background))', borderColor: 'hsl(var(--border))' }}
                                        />
                                        <Legend />
                                        <Bar
                                            dataKey={view === 'revenue' ? 'revenue' : 'quantity'}
                                            fill="hsl(var(--primary))"
                                            name={view === 'revenue' ? 'Ingresos' : 'Cantidad'}
                                            radius={[0, 4, 4, 0]}
                                        />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Products Table */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Análisis Detallado</CardTitle>
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
                                                    <td className="p-2">
                                                        <div className="font-medium">{product.name}</div>
                                                        <div className="text-[10px] text-muted-foreground">{product.sku}</div>
                                                    </td>
                                                    <td className="p-2 text-muted-foreground">{product.category || '-'}</td>
                                                    <td className="text-right p-2 font-bold">{product.quantity}</td>
                                                    <td className="text-right p-2 font-medium">{formatCurrency(product.revenue)}</td>
                                                    <td className="text-right p-2 text-muted-foreground">{formatCurrency(product.cost)}</td>
                                                    <td className={`text-right p-2 font-semibold ${product.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                        {formatCurrency(product.profit)}
                                                    </td>
                                                    <td className="text-right p-2">
                                                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${parseFloat(margin) > 30 ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                                                            {margin}%
                                                        </span>
                                                    </td>
                                                </tr>
                                            )
                                        })}
                                        {topProductsByView.length === 0 && (
                                            <tr>
                                                <td colSpan={8} className="p-8 text-center text-muted-foreground">
                                                    No se encontraron productos.
                                                </td>
                                            </tr>
                                        )}
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
