'use client'

import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { formatCurrency, formatNumber } from '@/lib/utils'
import { Package, Info } from 'lucide-react'

async function fetchInventoryValue() {
    const res = await fetch('/api/dashboard/inventory-value')
    if (!res.ok) throw new Error('Failed to fetch inventory value')
    return res.json()
}

export function InventoryValueReport() {
    const { data, isLoading } = useQuery({
        queryKey: ['inventory-value'],
        queryFn: fetchInventoryValue,
        staleTime: 60 * 1000,
    })

    if (isLoading) {
        return <Skeleton className="h-[300px] w-full" />
    }

    const { summary, categoryBreakdown } = data || { summary: { totalValue: 0, totalItems: 0 }, categoryBreakdown: [] }

    return (
        <Card className="col-span-1 lg:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between">
                <div>
                    <CardTitle className="text-lg font-bold">Valor del Inventario</CardTitle>
                    <p className="text-sm text-muted-foreground">Valor total de activos en stock</p>
                </div>
                <div className="flex items-center gap-4">
                    <div className="text-right">
                        <div className="text-2xl font-bold text-blue-600">{formatCurrency(summary.totalValue)}</div>
                        <div className="text-xs text-muted-foreground">{formatNumber(summary.totalItems)} unidades en total</div>
                    </div>
                    <div title="Calculado como la suma de (Costo Unitario * Cantidad) para todos los productos activos con stock.">
                        <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {categoryBreakdown.slice(0, 6).map((cat: any) => (
                            <div key={cat.name} className="flex items-center justify-between p-3 border rounded-lg bg-slate-50/50">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-white rounded-md shadow-sm border">
                                        <Package className="h-4 w-4 text-slate-500" />
                                    </div>
                                    <div>
                                        <div className="text-sm font-medium truncate max-w-[120px]">{cat.name}</div>
                                        <div className="text-[10px] text-muted-foreground">{formatNumber(cat.stock)} units</div>
                                    </div>
                                </div>
                                <div className="text-sm font-bold text-slate-700">
                                    {formatCurrency(cat.value)}
                                </div>
                            </div>
                        ))}
                    </div>

                    {categoryBreakdown.length > 6 && (
                        <p className="text-[10px] text-center text-muted-foreground italic">
                            + {categoryBreakdown.length - 6} categorías adicionales no mostradas en este resumen
                        </p>
                    )}
                </div>
            </CardContent>
        </Card>
    )
}
