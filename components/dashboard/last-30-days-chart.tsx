'use client'

import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCurrency } from '@/lib/utils'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import { Calendar } from 'lucide-react'
import { Period, PERIOD_CHART_TITLES } from './use-dashboard-period'

interface Last30DaysChartProps {
  period?: Period
}

async function fetchChartData(period: Period) {
  const res = await fetch(`/api/dashboard/last-30-days?period=${period}`)
  if (!res.ok) return []
  return res.json()
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3 shadow-xl">
      <p className="text-[11px] text-slate-400 font-bold uppercase tracking-wider mb-1.5">{label}</p>
      {payload.map((p: any, i: number) => (
        <div key={i} className="flex items-center gap-2 text-sm">
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
          <span className="text-slate-500 dark:text-slate-400">{p.name}:</span>
          <span className="font-bold text-slate-900 dark:text-white">
            {p.dataKey === 'sales' ? formatCurrency(p.value) : p.value}
          </span>
        </div>
      ))}
    </div>
  )
}

export function Last30DaysChart({ period = 'month' }: Last30DaysChartProps) {
  const { data, isLoading } = useQuery({
    queryKey: ['chart-data', period],
    queryFn: () => fetchChartData(period),
    refetchInterval: 60 * 1000,
    staleTime: 30 * 1000,
    refetchOnWindowFocus: true,
  })

  const chartData = data || []
  const totalSales = chartData.reduce((sum: number, d: any) => sum + (d.sales || 0), 0)
  const totalCount = chartData.reduce((sum: number, d: any) => sum + (d.count || 0), 0)
  const avgDaily = chartData.length > 0 ? totalSales / chartData.length : 0
  const bestDay = chartData.reduce((best: any, d: any) => (!best || d.sales > best.sales) ? d : best, null)
  const title = PERIOD_CHART_TITLES[period] || 'Últimos 30 Días'

  if (isLoading) {
    return (
      <Card className="border-slate-200/60 dark:border-slate-700/60">
        <CardHeader><CardTitle className="text-sm">{title}</CardTitle></CardHeader>
        <CardContent><div className="h-[320px] bg-slate-50 dark:bg-slate-800/50 animate-pulse rounded-xl" /></CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-slate-200/60 dark:border-slate-700/60 overflow-hidden">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-xl bg-blue-500/10 flex items-center justify-center">
              <Calendar size={16} className="text-blue-600" />
            </div>
            <div>
              <CardTitle className="text-sm">{title}</CardTitle>
              <p className="text-[11px] text-slate-400 mt-0.5">Tendencia de ventas · {totalCount} transacciones</p>
            </div>
          </div>
          <div className="flex items-center gap-4 text-right">
            <div>
              <div className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">Total</div>
              <div className="text-sm font-bold text-slate-900 dark:text-white">{formatCurrency(totalSales)}</div>
            </div>
            <div>
              <div className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">Promedio</div>
              <div className="text-sm font-bold text-slate-900 dark:text-white">{formatCurrency(avgDaily)}</div>
            </div>
            {bestDay && (
              <div>
                <div className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">Mejor</div>
                <div className="text-sm font-bold text-emerald-600">{bestDay.day}</div>
              </div>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <ResponsiveContainer width="100%" height={320}>
          <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="salesGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" strokeOpacity={0.5} vertical={false} />
            <XAxis
              dataKey="day"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 10, fill: '#94a3b8' }}
              interval={Math.max(0, Math.ceil(chartData.length / 10) - 1)}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 10, fill: '#94a3b8' }}
              tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}
              width={45}
            />
            <Tooltip content={<CustomTooltip />} />
            <Area
              type="monotone"
              dataKey="sales"
              stroke="#3b82f6"
              strokeWidth={2.5}
              fill="url(#salesGradient)"
              name="Ventas"
              dot={false}
              activeDot={{ r: 5, fill: '#3b82f6', strokeWidth: 2, stroke: '#fff' }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
