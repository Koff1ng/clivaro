'use client'

import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Package } from 'lucide-react'
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
} from 'recharts'

async function fetchProductCategories() {
  const res = await fetch('/api/dashboard/product-categories')
  if (!res.ok) return []
  const data = await res.json().catch(() => ({} as any))
  return data.categories || []
}

const COLORS = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#6366f1', '#14b8a6', '#f97316']

function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null
  const d = payload[0]
  return (
    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 shadow-lg text-xs">
      <div className="font-bold text-slate-700 dark:text-slate-200">{d.name}</div>
      <div className="text-slate-500">{d.value.toLocaleString()} productos</div>
    </div>
  )
}

export function ProductCategories() {
  const { data, isLoading } = useQuery({
    queryKey: ['product-categories'],
    queryFn: fetchProductCategories,
    refetchInterval: 60 * 1000,
    staleTime: 30 * 1000,
    refetchOnWindowFocus: true,
  })

  const categories = data || []
  const total = categories.reduce((s: number, c: any) => s + (c.value || 0), 0)

  return (
    <Card className="border-slate-200/60 dark:border-slate-700/60">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-xl bg-violet-500/10 flex items-center justify-center">
            <Package size={16} className="text-violet-600" />
          </div>
          <div>
            <CardTitle className="text-sm">Categorías</CardTitle>
            <p className="text-[10px] text-slate-400 mt-0.5">{total.toLocaleString()} productos totales</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {isLoading ? (
          <div className="h-[200px] bg-slate-50 dark:bg-slate-800/50 animate-pulse rounded-xl" />
        ) : categories.length === 0 ? (
          <div className="text-center py-6 text-sm text-slate-400">
            <Package className="h-8 w-8 mx-auto mb-2 opacity-30" />
            Sin categorías
          </div>
        ) : (
          <div className="space-y-3">
            {/* Mini donut chart */}
            <div className="flex justify-center">
              <ResponsiveContainer width={160} height={160}>
                <PieChart>
                  <Pie
                    data={categories.slice(0, 8)}
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={70}
                    paddingAngle={3}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {categories.slice(0, 8).map((_: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Legend */}
            <div className="space-y-1.5">
              {categories.slice(0, 6).map((cat: any, index: number) => {
                const pct = total > 0 ? ((cat.value / total) * 100).toFixed(0) : '0'
                return (
                  <div key={cat.name} className="flex items-center justify-between text-xs group">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                      <span className="text-slate-600 dark:text-slate-300 truncate max-w-[100px]">{cat.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 dark:text-white tabular-nums">{cat.value.toLocaleString()}</span>
                      <span className="text-[10px] text-slate-400 w-8 text-right">{pct}%</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
