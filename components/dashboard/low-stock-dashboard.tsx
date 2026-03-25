'use client'

import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { AlertTriangle, ExternalLink } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

async function fetchLowStock() {
  const res = await fetch('/api/inventory/low-stock')
  if (!res.ok) throw new Error('Failed to fetch low stock')
  return res.json()
}

export function LowStockDashboard() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['low-stock'],
    queryFn: fetchLowStock,
    refetchInterval: 30 * 1000,
    staleTime: 20 * 1000,
    refetchOnWindowFocus: true,
  })

  const items = data || []

  return (
    <Card className="border-slate-200/60 dark:border-slate-700/60">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-xl bg-red-500/10 flex items-center justify-center">
              <AlertTriangle size={16} className="text-red-500" />
            </div>
            <div>
              <CardTitle className="text-sm">Stock Bajo</CardTitle>
              <p className="text-[10px] text-slate-400 mt-0.5">
                {items.length > 0 ? `${items.length} alertas` : 'Sin alertas'}
              </p>
            </div>
          </div>
          <Link href="/inventory">
            <Button variant="ghost" size="sm" className="text-[10px] h-7 gap-1 text-slate-400 hover:text-slate-700">
              Ver todo <ExternalLink size={10} />
            </Button>
          </Link>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 bg-slate-50 dark:bg-slate-800/50 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : error ? (
          <div className="text-center py-4 text-sm text-red-500">Error al cargar</div>
        ) : items.length === 0 ? (
          <div className="text-center py-6">
            <div className="h-10 w-10 rounded-full bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center mx-auto mb-2">
              <span className="text-lg">✓</span>
            </div>
            <p className="text-xs text-slate-400">Todo el inventario está en orden</p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {items.slice(0, 5).map((item: any) => {
              const pct = item.minStock > 0 ? Math.min((item.quantity / item.minStock) * 100, 100) : 0
              const barColor = pct < 30 ? 'bg-red-500' : pct < 70 ? 'bg-amber-500' : 'bg-emerald-500'
              return (
                <div key={item.id} className="p-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-200 truncate max-w-[140px]">
                      {item.productName}
                    </span>
                    <span className="text-xs font-bold text-red-500 tabular-nums">{item.quantity}/{item.minStock}</span>
                  </div>
                  {/* Progress bar */}
                  <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div className={`h-full ${barColor} rounded-full transition-all`} style={{ width: `${pct}%` }} />
                  </div>
                  <div className="text-[9px] text-slate-400 mt-1">{item.warehouseName}</div>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
