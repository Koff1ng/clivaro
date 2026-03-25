'use client'

import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { formatCurrency, formatNumber } from '@/lib/utils'
import { Package, Info, Warehouse } from 'lucide-react'

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
        return <Skeleton className="h-[300px] w-full rounded-xl" />
    }

    const { summary, categoryBreakdown } = data || { summary: { totalValue: 0, totalItems: 0 }, categoryBreakdown: [] }

    return (
        <Card className="col-span-1 lg:col-span-2 border-slate-200/60 dark:border-slate-700/60">
            <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded-xl bg-amber-500/10 flex items-center justify-center">
                            <Warehouse size={16} className="text-amber-600" />
                        </div>
                        <div>
                            <CardTitle className="text-sm">Valor del Inventario</CardTitle>
                            <p className="text-[10px] text-slate-400 mt-0.5">Activos en stock</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-4 text-right">
                        <div>
                            <div className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">Total</div>
                            <div className="text-lg font-bold text-blue-600">{formatCurrency(summary.totalValue)}</div>
                        </div>
                        <div>
                            <div className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">Unidades</div>
                            <div className="text-lg font-bold text-slate-900 dark:text-white">{formatNumber(summary.totalItems)}</div>
                        </div>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="pt-0">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {categoryBreakdown.slice(0, 6).map((cat: any, i: number) => {
                        const pct = summary.totalValue > 0 ? ((cat.value / summary.totalValue) * 100) : 0
                        return (
                            <div key={cat.name}
                                className="flex items-center justify-between p-3 rounded-xl bg-slate-50/70 dark:bg-slate-800/30 hover:bg-slate-100/80 dark:hover:bg-slate-800/60 transition-colors"
                            >
                                <div className="flex items-center gap-2.5 min-w-0">
                                    <div className="h-7 w-7 rounded-lg bg-white dark:bg-slate-700 shadow-sm border border-slate-100 dark:border-slate-600 flex items-center justify-center flex-shrink-0">
                                        <Package className="h-3.5 w-3.5 text-slate-400" />
                                    </div>
                                    <div className="min-w-0">
                                        <div className="text-xs font-semibold text-slate-700 dark:text-slate-200 truncate">{cat.name}</div>
                                        <div className="text-[10px] text-slate-400">{formatNumber(cat.stock)} und</div>
                                    </div>
                                </div>
                                <div className="text-right flex-shrink-0 ml-2">
                                    <div className="text-xs font-bold text-slate-900 dark:text-white tabular-nums">
                                        {formatCurrency(cat.value)}
                                    </div>
                                    <div className="text-[9px] text-slate-400 font-bold">{pct.toFixed(1)}%</div>
                                </div>
                            </div>
                        )
                    })}
                </div>
                {categoryBreakdown.length > 6 && (
                    <p className="text-[10px] text-center text-slate-400 mt-3">
                        + {categoryBreakdown.length - 6} categorías más
                    </p>
                )}
            </CardContent>
        </Card>
    )
}
