'use client'

import { useQuery } from '@tanstack/react-query'
import { formatCurrency } from '@/lib/utils'
import { TrendingUp, DollarSign, AlertTriangle, ShoppingCart, ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react'
import { Period, PERIOD_LABELS } from './use-dashboard-period'

interface DashboardStatsProps {
  period: Period
  onPeriodChange: (period: Period) => void
}

async function fetchStats(period: Period) {
  const res = await fetch(`/api/dashboard/stats?period=${period}`)
  if (!res.ok) throw new Error('Failed to fetch stats')
  return res.json()
}

export function DashboardStats({ period, onPeriodChange }: DashboardStatsProps) {
  const { data, isLoading } = useQuery({
    queryKey: ['dashboard-stats', period],
    queryFn: () => fetchStats(period),
    refetchInterval: 30 * 1000,
    staleTime: 20 * 1000,
    refetchOnWindowFocus: true,
  })

  const stats = data || {
    salesToday: 0, salesMonth: 0, profitMonth: 0, salesCount: 0,
    totalProducts: 0, lowStockCount: 0, inCollection: 0,
    previousSales: 0, previousProfit: 0, previousSalesCount: 0,
  }

  const revenue = stats.salesMonth || stats.salesToday || 0
  const profit = stats.profitMonth || 0
  const inCollection = stats.inCollection || 0
  const salesCount = stats.salesCount || 0
  const prevRevenue = stats.previousSales || 0
  const prevProfit = stats.previousProfit || 0
  const prevCount = stats.previousSalesCount || 0

  const calcChange = (current: number, previous: number) => {
    if (previous === 0) return current > 0 ? 100 : 0
    return ((current - previous) / previous) * 100
  }

  const revenueChange = calcChange(revenue, prevRevenue)
  const profitChange = calcChange(profit, prevProfit)
  const countChange = calcChange(salesCount, prevCount)

  const cards = [
    {
      label: 'Ingresos', value: formatCurrency(revenue), change: revenueChange,
      icon: TrendingUp, bgGlow: 'bg-blue-500/10', iconBg: 'bg-blue-500/20 text-blue-600',
    },
    {
      label: 'Ganancias', value: formatCurrency(profit), change: profitChange,
      icon: DollarSign, bgGlow: 'bg-emerald-500/10', iconBg: 'bg-emerald-500/20 text-emerald-600',
    },
    {
      label: 'En Cobranza', value: formatCurrency(inCollection), change: null as number | null,
      icon: AlertTriangle, bgGlow: 'bg-amber-500/10', iconBg: 'bg-amber-500/20 text-amber-600',
      isWarning: inCollection > 0,
    },
    {
      label: 'Ventas', value: String(salesCount),
      subtitle: `${stats.totalProducts || 0} productos · ${stats.lowStockCount || 0} bajo stock`,
      change: countChange,
      icon: ShoppingCart, bgGlow: 'bg-violet-500/10', iconBg: 'bg-violet-500/20 text-violet-600',
    },
  ]

  return (
    <div className="space-y-4">
      {/* Period Selector */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Resumen</h2>
        <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800">
          {(Object.keys(PERIOD_LABELS) as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => onPeriodChange(p)}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all duration-200 ${
                period === p
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
              }`}
            >
              {PERIOD_LABELS[p]}
            </button>
          ))}
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => {
          const Icon = card.icon
          const isPositive = card.change !== null && card.change > 0
          const isNegative = card.change !== null && card.change < 0

          return (
            <div
              key={card.label}
              className="group relative overflow-hidden rounded-2xl border border-slate-200/60 dark:border-slate-700/60 bg-white dark:bg-slate-900 p-5 hover:shadow-lg hover:shadow-slate-200/50 dark:hover:shadow-slate-900/50 hover:-translate-y-0.5 transition-all duration-300"
            >
              <div className={`absolute -top-12 -right-12 w-32 h-32 rounded-full ${card.bgGlow} blur-2xl opacity-60 group-hover:opacity-100 transition-opacity`} />
              <div className="relative">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-[0.15em]">{card.label}</span>
                  <div className={`h-8 w-8 rounded-xl ${card.iconBg} flex items-center justify-center`}>
                    <Icon size={16} />
                  </div>
                </div>

                {isLoading ? (
                  <div className="h-8 w-28 bg-slate-100 dark:bg-slate-800 rounded animate-pulse" />
                ) : (
                  <div className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">{card.value}</div>
                )}

                <div className="mt-2 flex items-center gap-2">
                  {!isLoading && card.change !== null && (
                    <span className={`inline-flex items-center gap-0.5 text-[11px] font-bold px-1.5 py-0.5 rounded-md ${
                      isPositive ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400' :
                      isNegative ? 'bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400' :
                      'bg-slate-50 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                    }`}>
                      {isPositive ? <ArrowUpRight size={12} /> : isNegative ? <ArrowDownRight size={12} /> : <Minus size={12} />}
                      {Math.abs(card.change).toFixed(1)}%
                    </span>
                  )}
                  {card.subtitle && (
                    <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">{card.subtitle}</span>
                  )}
                  {card.isWarning && !isLoading && inCollection > 0 && (
                    <span className="text-[10px] text-amber-500 font-bold">Pendiente</span>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
