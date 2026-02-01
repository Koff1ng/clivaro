'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ReportLayout } from '@/components/reports/report-layout'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { formatCurrency } from '@/lib/utils'
import { AlertTriangle, Warehouse, ArrowDownRight, Package, Calculator } from 'lucide-react'

async function fetchLowStock(warehouseId?: string) {
    const params = new URLSearchParams()
    if (warehouseId && warehouseId !== 'all') {
        params.append('warehouseId', warehouseId)
    }
    const res = await fetch(`/api/reports/low-stock?${params}`)
    if (!res.ok) throw new Error('Failed to fetch report')
    return res.json()
}

async function fetchWarehouses() {
    const res = await fetch('/api/warehouses')
    if (!res.ok) throw new Error('Failed to fetch warehouses')
    return res.json()
}

export function LowStockReport() {
    const [selectedWarehouse, setSelectedWarehouse] = useState<string>('all')
    const [searchTerm, setSearchTerm] = useState('')

    const { data: warehouses = [] } = useQuery({
        queryKey: ['warehouses'],
        queryFn: fetchWarehouses
    })

    const { data, isLoading, error } = useQuery({
        queryKey: ['low-stock-report', selectedWarehouse],
        queryFn: () => fetchLowStock(selectedWarehouse),
    })

    const handlePrint = () => {
        window.print()
    }

    const filteredItems = (data?.items || []).filter((item: any) =>
        item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.sku.toLowerCase().includes(searchTerm.toLowerCase())
    )

    const handleExport = () => {
        const csvContent = [
            ['SKU', 'Producto', 'Categoría', 'Stock Actual', 'Mínimo', 'Déficit'],
            ...(filteredItems.map((item: any) => [
                item.sku,
                item.name,
                item.category,
                item.stockByWarehouse[0]?.quantity || 0,
                item.stockByWarehouse[0]?.minStock || 0,
                item.stockByWarehouse[0]?.deficit || 0,
            ])),
        ]
            .map(row => row.join(','))
            .join('\n')

        const blob = new Blob([csvContent], { type: 'text/csv' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `reporte-bajo-stock-${new Date().toISOString().split('T')[0]}.csv`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
    }

    return (
        <ReportLayout
            title="Alertas de Stock Bajo"
            description="Productos que requieren reabastecimiento urgente por nivel crítico"
            onPrint={handlePrint}
            onExport={handleExport}
            filters={
                <div className="flex flex-wrap items-center gap-4">
                    <div className="flex items-center gap-2">
                        <Warehouse className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium">Almacén:</span>
                        <select
                            value={selectedWarehouse}
                            onChange={(e) => setSelectedWarehouse(e.target.value)}
                            className="flex h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                        >
                            <option value="all">Todos los Almacenes</option>
                            {warehouses.map((w: any) => (
                                <option key={w.id} value={w.id}>
                                    {w.name}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className="flex-1 min-w-[200px]">
                        <input
                            type="text"
                            placeholder="Buscar producto..."
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
                    <p className="mt-2 text-muted-foreground">Analizando inventario...</p>
                </div>
            )}

            {error && (
                <div className="p-8 text-center text-destructive bg-destructive/10 rounded-xl">
                    Error al cargar las alertas. Por favor intente de nuevo.
                </div>
            )}

            {data && (
                <div className="space-y-6">
                    {/* Summary Cards */}
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        <Card className="border-red-200 bg-red-50">
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium text-red-900">Productos Críticos</CardTitle>
                                <AlertTriangle className="h-4 w-4 text-red-600" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-3xl font-bold text-red-700">
                                    {data.summary.totalCount}
                                </div>
                                <p className="text-xs text-red-600 mt-1">
                                    Necesitan reabastecimiento inmediato
                                </p>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Unidades Faltantes</CardTitle>
                                <ArrowDownRight className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-3xl font-bold">
                                    {data.summary.totalDeficit}
                                </div>
                                <p className="text-xs text-muted-foreground mt-1">
                                    Para alcanzar stock mínimo ideal
                                </p>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Inversión Necesaria</CardTitle>
                                <Calculator className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-3xl font-bold text-blue-600">
                                    {formatCurrency(data.items.reduce((acc: number, item: any) =>
                                        acc + item.stockByWarehouse.reduce((s: number, sw: any) => s + (sw.deficit * (item.cost || 0)), 0), 0))}
                                </div>
                                <p className="text-xs text-muted-foreground mt-1">
                                    Estimado para surtir faltantes
                                </p>
                            </CardContent>
                        </Card>
                    </div>

                    <div className="grid gap-6">
                        {filteredItems.map((item: any) => (
                            <Card key={item.id} className="overflow-hidden border-l-4 border-l-red-500">
                                <CardHeader className="py-4">
                                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                        <div className="flex items-start gap-4">
                                            <div className="p-3 bg-red-100 rounded-xl text-red-600">
                                                <Package className="h-6 w-6" />
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <h3 className="font-bold text-lg">{item.name}</h3>
                                                    <span className="px-2 py-0.5 rounded-full bg-muted text-[10px] font-mono text-muted-foreground">
                                                        {item.sku}
                                                    </span>
                                                </div>
                                                <p className="text-sm text-muted-foreground">{item.category}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-8">
                                            {item.stockByWarehouse.map((sw: any, idx: number) => (
                                                <div key={idx} className="text-right">
                                                    <div className="text-xs text-muted-foreground flex items-center justify-end gap-1">
                                                        <Warehouse className="h-3 w-3" />
                                                        {sw.warehouseName}
                                                    </div>
                                                    <div className="text-2xl font-black text-red-600">
                                                        {sw.quantity} <span className="text-sm font-normal text-muted-foreground">/ {sw.minStock}</span>
                                                    </div>
                                                    <div className="text-[10px] font-bold text-red-500 uppercase tracking-tighter">
                                                        Faltan {sw.deficit} und.
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </CardHeader>
                            </Card>
                        ))}

                        {filteredItems.length === 0 && (
                            <div className="p-12 text-center bg-green-50 border border-green-100 rounded-3xl">
                                <div className="mx-auto w-12 h-12 bg-green-100 rounded-full flex items-center justify-center text-green-600 mb-4">
                                    <Package className="h-6 w-6" />
                                </div>
                                <h3 className="text-lg font-bold text-green-900">¡Todo al día!</h3>
                                <p className="text-green-700">No se encontraron productos con stock bajo el nivel mínimo.</p>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </ReportLayout>
    )
}
