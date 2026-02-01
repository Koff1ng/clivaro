'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ReportLayout } from '@/components/reports/report-layout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCurrency } from '@/lib/utils'
import { Package, Warehouse, DollarSign, Calculator, TrendingUp } from 'lucide-react'

async function fetchCurrentStock(warehouseId?: string) {
    const params = new URLSearchParams()
    if (warehouseId && warehouseId !== 'all') {
        params.append('warehouseId', warehouseId)
    }
    const res = await fetch(`/api/reports/current-stock?${params}`)
    if (!res.ok) throw new Error('Failed to fetch report')
    return res.json()
}

async function fetchWarehouses() {
    const res = await fetch('/api/warehouses')
    if (!res.ok) throw new Error('Failed to fetch warehouses')
    return res.json()
}

export function CurrentStockReport() {
    const [selectedWarehouse, setSelectedWarehouse] = useState<string>('all')

    const { data: warehouses = [] } = useQuery({
        queryKey: ['warehouses'],
        queryFn: fetchWarehouses
    })

    const { data, isLoading, error } = useQuery({
        queryKey: ['current-stock-report', selectedWarehouse],
        queryFn: () => fetchCurrentStock(selectedWarehouse),
    })

    const handlePrint = () => {
        window.print()
    }

    const handleExport = () => {
        const csvContent = [
            ['SKU', 'Producto', 'Categoría', 'Stock Total', 'Costo Unitario', 'Valor Costo', 'Precio Venta', 'Valor Venta'],
            ...((data?.items || []).map((item: any) => [
                item.sku,
                item.name,
                item.category,
                item.totalQuantity,
                item.cost,
                item.totalCostValue,
                item.price,
                item.totalPriceValue,
            ])),
        ]
            .map(row => row.join(','))
            .join('\n')

        const blob = new Blob([csvContent], { type: 'text/csv' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `stock-actual-${new Date().toISOString().split('T')[0]}.csv`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
    }

    return (
        <ReportLayout
            title="Stock Actual y Valorización"
            description="Estado actual del inventario con valorización a costo y precio de venta"
            onPrint={handlePrint}
            onExport={handleExport}
            filters={
                <div className="flex items-center gap-4">
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
                                <CardTitle className="text-sm font-medium">Valor a Costo</CardTitle>
                                <DollarSign className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold text-blue-600">
                                    {formatCurrency(data.summary.totalInventoryValueCost)}
                                </div>
                                <p className="text-xs text-muted-foreground mt-1">
                                    Inversión en stock actual
                                </p>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Valor a Venta</CardTitle>
                                <TrendingUp className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold text-green-600">
                                    {formatCurrency(data.summary.totalInventoryValuePrice)}
                                </div>
                                <p className="text-xs text-muted-foreground mt-1">
                                    Ingreso potencial bruto
                                </p>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Margen Potencial</CardTitle>
                                <Calculator className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold text-orange-600">
                                    {formatCurrency(data.summary.potentialProfit)}
                                </div>
                                <p className="text-xs text-muted-foreground mt-1">
                                    Ganancia proyectada
                                </p>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Artículos Totales</CardTitle>
                                <Package className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">
                                    {data.summary.totalItemsCount}
                                </div>
                                <p className="text-xs text-muted-foreground mt-1">
                                    {data.summary.distinctProductsCount} productos distintos
                                </p>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Detailed Table */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Detalle por Producto</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b">
                                            <th className="text-left p-2">SKU</th>
                                            <th className="text-left p-2">Producto</th>
                                            <th className="text-right p-2">Stock</th>
                                            <th className="text-right p-2">Costo Unit.</th>
                                            <th className="text-right p-2">Valor Costo</th>
                                            <th className="text-right p-2">Precio Venta</th>
                                            <th className="text-right p-2">Valor Venta</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {data.items.map((item: any) => (
                                            <tr key={item.id} className="border-b hover:bg-muted/50">
                                                <td className="p-2 font-mono text-xs">{item.sku}</td>
                                                <td className="p-2">
                                                    <div className="font-medium">{item.name}</div>
                                                    <div className="text-[10px] text-muted-foreground">{item.category}</div>
                                                </td>
                                                <td className="text-right p-2 font-bold">{item.totalQuantity}</td>
                                                <td className="text-right p-2">{formatCurrency(item.cost)}</td>
                                                <td className="text-right p-2 font-medium">{formatCurrency(item.totalCostValue)}</td>
                                                <td className="text-right p-2">{formatCurrency(item.price)}</td>
                                                <td className="text-right p-3 font-semibold text-green-600">{formatCurrency(item.totalPriceValue)}</td>
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
