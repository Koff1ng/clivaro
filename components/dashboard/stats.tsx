'use client'

import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { formatCurrency } from '@/lib/utils'
import { TrendingUp, Package, DollarSign, AlertTriangle } from 'lucide-react'

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
      <div className="grid gap-4 md:grid-cols-4">
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
    <div className="grid gap-4 md:grid-cols-4">
      {/* Ingresos - Azul */}
      <Card className="border-l-4 border-l-blue-500">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Ingresos</CardTitle>
          <TrendingUp className="h-5 w-5 text-blue-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatCurrency(stats.salesMonth)}</div>
        </CardContent>
      </Card>
      
      {/* Ganancias - Teal */}
      <Card className="border-l-4 border-l-teal-500">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Ganancias</CardTitle>
          <DollarSign className="h-5 w-5 text-teal-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatCurrency(earnings)}</div>
        </CardContent>
      </Card>
      
      {/* En Cobranza - Naranja */}
      <Card className="border-l-4 border-l-orange-500">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">En Cobranza</CardTitle>
          <AlertTriangle className="h-5 w-5 text-orange-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatCurrency(inCollection)}</div>
        </CardContent>
      </Card>
      
      {/* Ventas - Amarillo */}
      <Card className="border-l-4 border-l-yellow-500">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Ventas</CardTitle>
          <Package className="h-5 w-5 text-yellow-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.salesCount || 0}</div>
        </CardContent>
      </Card>
    </div>
  )
}

