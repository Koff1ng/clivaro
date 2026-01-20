'use client'

import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { formatCurrency } from '@/lib/utils'
import { TrendingUp, Package, DollarSign, AlertTriangle } from 'lucide-react'
import { AppIcon } from '@/components/ui/app-icon'

async function fetchStats() {
  const res = await fetch('/api/dashboard/stats')
  if (!res.ok) throw new Error('Failed to fetch stats')
  return res.json()
}

export function DashboardStats() {
  const { data, isLoading } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: fetchStats,
    refetchInterval: 30 * 1000, // Actualizar cada 30 segundos
    staleTime: 20 * 1000, // Los datos se consideran frescos por 20 segundos
    gcTime: 2 * 60 * 1000, // 2 minutos en cache
    refetchOnWindowFocus: true, // Refrescar cuando se vuelve a la pestaña
  })

  if (isLoading) {
    return (
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-4" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-32" />
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  const stats = data || {
    salesToday: 0,
    salesMonth: 0,
    profitMonth: 0,
    salesCount: 0,
    totalProducts: 0,
    lowStockCount: 0,
    inCollection: 0,
  }

  const earnings = stats.profitMonth || 0
  // En cobranza viene directamente del API (suma de facturas pendientes)
  const inCollection = stats.inCollection || 0

  return (
    <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
      {/* Ingresos */}
      <Card className="group border-none bg-gradient-to-b from-slate-50 to-white dark:from-slate-900/50 dark:to-slate-900 hover:-translate-y-[1px] hover:shadow-[0_18px_40px_rgba(15,23,42,0.08)] transition-all duration-150 ease-out">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-xs font-medium text-muted-foreground tracking-[0.12em] uppercase">
            Ingresos
          </CardTitle>
          <div className="rounded-full bg-blue-50 dark:bg-blue-900/30 p-2">
            <AppIcon icon={TrendingUp} size={18} className="text-blue-600 dark:text-blue-400" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-semibold tracking-tight">
            {formatCurrency(stats.salesMonth)}
          </div>
        </CardContent>
      </Card>

      {/* Ganancias */}
      <Card className="group border-none bg-gradient-to-b from-slate-50 to-white dark:from-slate-900/50 dark:to-slate-900 hover:-translate-y-[1px] hover:shadow-[0_18px_40px_rgba(15,23,42,0.08)] transition-all duration-150 ease-out">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-xs font-medium text-muted-foreground tracking-[0.12em] uppercase">
            Ganancias
          </CardTitle>
          <div className="rounded-full bg-teal-50 dark:bg-teal-900/30 p-2">
            <AppIcon icon={DollarSign} size={18} className="text-teal-600 dark:text-teal-400" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-semibold tracking-tight">
            {formatCurrency(earnings)}
          </div>
        </CardContent>
      </Card>

      {/* En Cobranza */}
      <Card className="group border-none bg-gradient-to-b from-slate-50 to-white dark:from-slate-900/50 dark:to-slate-900 hover:-translate-y-[1px] hover:shadow-[0_18px_40px_rgba(15,23,42,0.08)] transition-all duration-150 ease-out">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-xs font-medium text-muted-foreground tracking-[0.12em] uppercase">
            En cobranza
          </CardTitle>
          <div className="rounded-full bg-amber-50 dark:bg-amber-900/30 p-2">
            <AppIcon icon={AlertTriangle} size={18} className="text-amber-600 dark:text-amber-400" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-semibold tracking-tight">
            {formatCurrency(inCollection)}
          </div>
        </CardContent>
      </Card>

      {/* Ventas */}
      <Card className="group border-none bg-gradient-to-b from-slate-50 to-white dark:from-slate-900/50 dark:to-slate-900 hover:-translate-y-[1px] hover:shadow-[0_18px_40px_rgba(15,23,42,0.08)] transition-all duration-150 ease-out">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-xs font-medium text-muted-foreground tracking-[0.12em] uppercase">
            Ventas
          </CardTitle>
          <div className="rounded-full bg-indigo-50 dark:bg-indigo-900/30 p-2">
            <AppIcon icon={Package} size={18} className="text-indigo-600 dark:text-indigo-400" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-semibold tracking-tight">
            {stats.salesCount || 0}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

