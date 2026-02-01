'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ReportLayout } from '@/components/reports/report-layout'
import { DateRangeFilter, DateRange } from '@/components/reports/date-range-filter'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCurrency } from '@/lib/utils'
import { subDays, format } from 'date-fns'
import { es } from 'date-fns/locale'
import { ArrowUpCircle, ArrowDownCircle, Scale, History, TrendingUp, DollarSign } from 'lucide-react'
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
    AreaChart, Area
} from 'recharts'

async function fetchCashFlow(from: Date, to: Date) {
    const params = new URLSearchParams({
        from: from.toISOString(),
        to: to.toISOString(),
    })
    const res = await fetch(`/api/reports/cash-flow?${params}`)
    if (!res.ok) throw new Error('Failed to fetch report')
    return res.json()
}

export function CashFlowReport() {
    const [dateRange, setDateRange] = useState<DateRange>({
        from: subDays(new Date(), 29),
        to: new Date(),
    })
    const [searchTerm, setSearchTerm] = useState('')

    const { data, isLoading, error } = useQuery({
        queryKey: ['cash-flow-report', dateRange.from.toISOString(), dateRange.to.toISOString()],
        queryFn: () => fetchCashFlow(dateRange.from, dateRange.to),
    })

    const filteredMovements = (data?.movements || []).filter((m: any) =>
        m.reason.toLowerCase().includes(searchTerm.toLowerCase()) ||
        m.userName.toLowerCase().includes(searchTerm.toLowerCase())
    )

    const handlePrint = () => {
        window.print()
    }

    const handleExport = () => {
        const csvContent = [
            ['Fecha', 'Tipo', 'Monto', 'Concepto', 'Usuario'],
            ...((data?.movements || []).map((m: any) => [
                format(new Date(m.createdAt), 'yyyy-MM-dd HH:mm'),
                m.type === 'IN' ? 'Entrada' : 'Salida',
                m.amount,
                m.reason || '',
                m.userName,
            ])),
        ]
            .map(row => row.join(','))
            .join('\n')

        const blob = new Blob([csvContent], { type: 'text/csv' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `flujo-caja-${dateRange.from.toISOString().split('T')[0]}.csv`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
    }

    return (
        <ReportLayout
            title="Flujo de Caja"
            description="Seguimiento de ingresos, egresos y ventas realizadas"
            onPrint={handlePrint}
            onExport={handleExport}
            filters={
                <div className="flex flex-wrap items-center gap-4">
                    <DateRangeFilter value={dateRange} onChange={setDateRange} />
                    <div className="flex-1 min-w-[200px]">
                        <input
                            type="text"
                            placeholder="Buscar por motivo o usuario..."
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
                                <CardTitle className="text-sm font-medium">Ventas (Entradas)</CardTitle>
                                <ArrowUpCircle className="h-4 w-4 text-green-600" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold text-green-600">
                                    {formatCurrency(data.summary.totalSales)}
                                </div>
                                <p className="text-xs text-muted-foreground mt-1">
                                    Ingresos por facturación
                                </p>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Otros Ingresos</CardTitle>
                                <TrendingUp className="h-4 w-4 text-blue-600" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold text-blue-600">
                                    {formatCurrency(data.summary.totalIn)}
                                </div>
                                <p className="text-xs text-muted-foreground mt-1">
                                    Cargas manuales
                                </p>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Salidas / Devol.</CardTitle>
                                <ArrowDownCircle className="h-4 w-4 text-red-600" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold text-red-600">
                                    {formatCurrency(data.summary.totalOut)}
                                </div>
                                <p className="text-xs text-muted-foreground mt-1">
                                    Gastos y devoluciones
                                </p>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Flujo Neto</CardTitle>
                                <Scale className="h-4 w-4 text-primary" />
                            </CardHeader>
                            <CardContent>
                                <div className={`text-2xl font-bold ${data.summary.netFlow >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                    {formatCurrency(data.summary.netFlow)}
                                </div>
                                <p className="text-xs text-muted-foreground mt-1">
                                    Balance del período
                                </p>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Chart: Daily Flow */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Evolución del Flujo de Caja</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="h-[400px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={data.daily}>
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis
                                            dataKey="date"
                                            tickFormatter={(val) => format(new Date(val), 'dd MMM')}
                                        />
                                        <YAxis />
                                        <Tooltip
                                            labelFormatter={(val) => format(new Date(val), 'PPPP', { locale: es })}
                                            formatter={(value: any) => formatCurrency(value)}
                                        />
                                        <Legend />
                                        <Area type="monotone" dataKey="sales" stackId="1" stroke="#10b981" fill="#10b981" fillOpacity={0.4} name="Ventas" />
                                        <Area type="monotone" dataKey="in" stackId="1" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.2} name="Otros Ingresos" />
                                        <Area type="monotone" dataKey="out" stroke="#ef4444" fill="#ef4444" fillOpacity={0.1} name="Salidas" />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Recent Movements Table */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <History className="h-5 w-5" />
                                Últimos Movimientos
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b">
                                            <th className="text-left p-2">Fecha</th>
                                            <th className="text-left p-2">Tipo</th>
                                            <th className="text-left p-2">Origen</th>
                                            <th className="text-left p-2">Concepto</th>
                                            <th className="text-right p-2">Monto</th>
                                            <th className="text-left p-2">Usuario</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredMovements.map((m: any) => (
                                            <tr key={m.id} className="border-b hover:bg-muted/50">
                                                <td className="p-2 text-xs text-muted-foreground">
                                                    {format(new Date(m.createdAt), 'dd MMM, HH:mm', { locale: es })}
                                                </td>
                                                <td className="p-2">
                                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${m.type === 'IN' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                                        {m.type === 'IN' ? 'ENTRADA' : 'SALIDA'}
                                                    </span>
                                                </td>
                                                <td className="p-2 text-[10px] font-medium text-muted-foreground uppercase">
                                                    {m.source}
                                                </td>
                                                <td className="p-2">{m.reason || '-'}</td>
                                                <td className={`text-right p-2 font-semibold ${m.type === 'IN' ? 'text-green-600' : 'text-red-600'}`}>
                                                    {m.type === 'IN' ? '+' : '-'}{formatCurrency(m.amount)}
                                                </td>
                                                <td className="p-2 text-muted-foreground">{m.userName}</td>
                                            </tr>
                                        ))}
                                        {filteredMovements.length === 0 && (
                                            <tr>
                                                <td colSpan={6} className="p-8 text-center text-muted-foreground">
                                                    No se encontraron movimientos.
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
