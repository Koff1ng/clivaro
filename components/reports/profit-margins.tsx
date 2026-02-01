'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ReportLayout } from '@/components/reports/report-layout'
import { DateRangeFilter, DateRange } from '@/components/reports/date-range-filter'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCurrency } from '@/lib/utils'
import { subDays } from 'date-fns'
import { TrendingUp, Percent, DollarSign, PieChart as PieIcon } from 'lucide-react'
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
    PieChart, Pie, Cell, LineChart, Line
} from 'recharts'

async function fetchProfitMargins(from: Date, to: Date) {
    const params = new URLSearchParams({
        from: from.toISOString(),
        to: to.toISOString(),
    })
    const res = await fetch(`/api/reports/profit-margins?${params}`)
    if (!res.ok) throw new Error('Failed to fetch report')
    return res.json()
}

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899']

export function ProfitMarginsReport() {
    const [dateRange, setDateRange] = useState<DateRange>({
        from: subDays(new Date(), 29),
        to: new Date(),
    })

    const { data, isLoading, error } = useQuery({
        queryKey: ['profit-margins-report', dateRange.from.toISOString(), dateRange.to.toISOString()],
        queryFn: () => fetchProfitMargins(dateRange.from, dateRange.to),
    })

    const handlePrint = () => {
        window.print()
    }

    const handleExport = () => {
        const csvContent = [
            ['Categoría', 'Ingresos', 'Costos', 'Ganancia', 'Margen %'],
            ...((data?.byCategory || []).map((c: any) => [
                c.name,
                c.revenue,
                c.cost,
                c.profit,
                c.margin.toFixed(2),
            ])),
        ]
            .map(row => row.join(','))
            .join('\n')

        const blob = new Blob([csvContent], { type: 'text/csv' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `margenes-ganancia-${dateRange.from.toISOString().split('T')[0]}.csv`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
    }

    return (
        <ReportLayout
            title="Márgenes de Ganancia"
            description="Análisis de rentabilidad por categoría y evolución temporal"
            onPrint={handlePrint}
            onExport={handleExport}
            filters={<DateRangeFilter value={dateRange} onChange={setDateRange} />}
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
                                <CardTitle className="text-sm font-medium">Margen Global</CardTitle>
                                <Percent className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold text-primary">
                                    {data.summary.overallMargin.toFixed(2)}%
                                </div>
                                <p className="text-xs text-muted-foreground mt-1">
                                    Promedio en el período
                                </p>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Ganancia Total</CardTitle>
                                <DollarSign className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold text-green-600">
                                    {formatCurrency(data.summary.totalProfit)}
                                </div>
                                <p className="text-xs text-muted-foreground mt-1">
                                    Ingresos menos costos
                                </p>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Ingresos Totales</CardTitle>
                                <TrendingUp className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">
                                    {formatCurrency(data.summary.totalRevenue)}
                                </div>
                                <p className="text-xs text-muted-foreground mt-1">
                                    Ventas brutas pagadas
                                </p>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Costos Totales</CardTitle>
                                <Percent className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold text-muted-foreground">
                                    {formatCurrency(data.summary.totalCost)}
                                </div>
                                <p className="text-xs text-muted-foreground mt-1">
                                    Costo de mercancía vendida
                                </p>
                            </CardContent>
                        </Card>
                    </div>

                    <div className="grid gap-6 md:grid-cols-2">
                        {/* Pie Chart: Profit by Category */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <PieIcon className="h-5 w-5" />
                                    Ganancia por Categoría
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="h-[300px]">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie
                                                data={data.byCategory}
                                                cx="50%"
                                                cy="50%"
                                                innerRadius={60}
                                                outerRadius={100}
                                                paddingAngle={5}
                                                dataKey="profit"
                                                nameKey="name"
                                            >
                                                {data.byCategory.map((entry: any, index: number) => (
                                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                                ))}
                                            </Pie>
                                            <Tooltip formatter={(value: any) => formatCurrency(value)} />
                                            <Legend />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Area Chart: Revenue vs Cost */}
                        <Card>
                            <CardHeader>
                                <CardTitle>Rentabilidad Temporal</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="h-[300px]">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <LineChart data={data.byDay}>
                                            <CartesianGrid strokeDasharray="3 3" />
                                            <XAxis dataKey="date" />
                                            <YAxis />
                                            <Tooltip formatter={(value: any) => formatCurrency(value)} />
                                            <Legend />
                                            <Line type="monotone" dataKey="revenue" stroke="#3b82f6" name="Ingresos" strokeWidth={2} />
                                            <Line type="monotone" dataKey="cost" stroke="#94a3b8" name="Costos" strokeWidth={2} />
                                            <Line type="monotone" dataKey="profit" stroke="#10b981" name="Ganancia" strokeWidth={3} />
                                        </LineChart>
                                    </ResponsiveContainer>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Detailed Table */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Análisis por Categoría</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b">
                                            <th className="text-left p-2">Categoría</th>
                                            <th className="text-right p-2">Ingresos</th>
                                            <th className="text-right p-2">Costos</th>
                                            <th className="text-right p-2">Ganancia</th>
                                            <th className="text-right p-2">Margen</th>
                                            <th className="text-right p-2">% del Total</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {data.byCategory.map((c: any) => (
                                            <tr key={c.name} className="border-b hover:bg-muted/50">
                                                <td className="p-2 font-medium">{c.name}</td>
                                                <td className="text-right p-2">{formatCurrency(c.revenue)}</td>
                                                <td className="text-right p-2 text-muted-foreground">{formatCurrency(c.cost)}</td>
                                                <td className="text-right p-2 font-bold text-green-600">{formatCurrency(c.profit)}</td>
                                                <td className="text-right p-2">
                                                    <span className={`px-2 py-0.5 rounded text-xs font-semibold ${c.margin > 30 ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                                                        {c.margin.toFixed(1)}%
                                                    </span>
                                                </td>
                                                <td className="text-right p-2">
                                                    {((c.profit / data.summary.totalProfit) * 100).toFixed(1)}%
                                                </td>
                                            </tr>
                                        ))}
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
